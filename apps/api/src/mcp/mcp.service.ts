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

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private clients = new Map<string, Client>();
  private toolsByServer = new Map<string, Tool[]>();
  private toolClientMap = new Map<string, string>(); // tool name -> server id

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
    const serverId = this.toolClientMap.get(name);
    const client = serverId
      ? this.clients.get(serverId)
      : this.clients.values().next().value;
    if (!client) throw new Error('MCP not connected');
    return client.callTool({ name, arguments: args }) as Promise<CallToolResult>;
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
