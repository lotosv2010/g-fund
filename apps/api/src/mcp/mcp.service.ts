import { join } from 'path';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { Client } from '@modelcontextprotocol/sdk/client';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types';
import type { McpServer, McpConfig } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

interface CacheEntry {
  result: CallToolResult;
  fetchedAt: number;
}

// TTL 策略：按工具类型设置不同缓存时长
const CACHE_TTL_ASSET_CLASS = 60 * 60 * 1000; // 资产分类：1 小时
const CACHE_TTL_TRADING = 30_000; // 交易时段净值：30s
const CACHE_TTL_IDLE = 5 * 60 * 1000; // 非交易时段净值：5min
const CACHE_TTL_DEFAULT = 5 * 60 * 1000; // 其他工具：5min

const NAV_TOOL_PATTERN = /[_-]?(nav|净值|history)/i;
const ASSET_CLASS_TOOL_PATTERN = /asset[_-]?class/i;

function isTradingHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const hhmm = now.getHours() * 100 + now.getMinutes();
  return hhmm >= 930 && hhmm <= 1500;
}

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private clients = new Map<string, Client>();
  private toolsByServer = new Map<string, Tool[]>();
  private toolClientMap = new Map<string, string>(); // tool name -> server id
  private readonly callCache = new Map<string, CacheEntry>();

  constructor(@Inject(DB) private readonly db: DbType) {}

  async onModuleInit() {
    const config = await this.loadMcpConfig();
    if (config.length === 0) {
      this.logger.warn('No MCP servers configured, MCP disabled');
      return;
    }
    for (const server of config.filter((s) => s.enabled && s.url)) {
      await this.connectServer(server);
    }
  }

  private async loadMcpConfig(): Promise<McpConfig> {
    try {
      const [row] = await this.db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, 'mcp_config'));
      if (!row) return [];
      return JSON.parse(row.value) as McpConfig;
    } catch {
      return [];
    }
  }

  async onModuleDestroy() {
    await this.disconnectAll();
  }

  async reconnectAll(servers: McpServer[]): Promise<void> {
    await this.disconnectAll();
    for (const server of servers.filter((s) => s.enabled && s.url)) {
      await this.connectServer(server);
    }
  }

  isConnected(): boolean {
    return this.clients.size > 0;
  }

  getTools(): Tool[] {
    return [...this.toolsByServer.values()].flat();
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
    const cacheKey = `${name}:${JSON.stringify(args ?? {})}`;
    const cached = this.callCache.get(cacheKey);
    if (cached) {
      const ttl = this.getCacheTtl(name);
      if (Date.now() - cached.fetchedAt < ttl) {
        this.logger.debug(`MCP cache hit: ${name}`);
        return cached.result;
      }
      this.callCache.delete(cacheKey);
    }

    const serverId = this.toolClientMap.get(name);
    const client = serverId
      ? this.clients.get(serverId)
      : this.clients.values().next().value;
    if (!client) throw new Error('MCP not connected');
    const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
    this.callCache.set(cacheKey, { result, fetchedAt: Date.now() });
    return result;
  }

  async callTools(
    calls: { name: string; args?: Record<string, unknown> }[],
  ): Promise<(CallToolResult | Error)[]> {
    const results = await Promise.allSettled(
      calls.map((c) => this.callTool(c.name, c.args)),
    );
    return results.map((r) =>
      r.status === 'fulfilled' ? r.value : r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
    );
  }

  private getCacheTtl(toolName: string): number {
    if (ASSET_CLASS_TOOL_PATTERN.test(toolName)) return CACHE_TTL_ASSET_CLASS;
    if (NAV_TOOL_PATTERN.test(toolName)) return isTradingHours() ? CACHE_TTL_TRADING : CACHE_TTL_IDLE;
    return CACHE_TTL_DEFAULT;
  }

  clearCache(): void {
    this.callCache.clear();
  }

  private async connectServer(server: McpServer): Promise<void> {
    try {
      // MCP SDK exports map 未暴露 ./client/streamableHttp 子路径给 CJS，直接引用文件绕过
      const clientDir = join(require.resolve('@modelcontextprotocol/sdk/client'), '..');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { StreamableHTTPClientTransport } = require(join(clientDir, 'streamableHttp.js'));
      const transport = new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: server.apiKey ? { headers: { 'X-Api-Key': server.apiKey } } : undefined,
      });
      const client = new Client({ name: 'g-fund-agent', version: '1.0.0' });
      await client.connect(transport);

      const result = await client.listTools();
      this.clients.set(server.id, client);
      this.toolsByServer.set(server.id, result.tools);
      for (const tool of result.tools) {
        this.toolClientMap.set(tool.name, server.id);
      }
      this.logger.log(`[${server.name}] MCP connected, ${result.tools.length} tools`);
    } catch (error) {
      this.logger.error(`[${server.name}] MCP connection failed: ${(error as Error).message}`);
    }
  }

  private async disconnectAll(): Promise<void> {
    for (const [id, client] of this.clients) {
      await client.close().catch(() => {});
      this.logger.log(`[${id}] MCP disconnected`);
    }
    this.clients.clear();
    this.toolsByServer.clear();
    this.toolClientMap.clear();
  }
}
