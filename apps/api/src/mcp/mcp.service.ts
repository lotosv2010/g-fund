import { join } from 'path';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types';

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private client: Client | null = null;
  private tools: Tool[] = [];
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('QIEMAN_MCP_URL');
    const apiKey = this.config.get<string>('QIEMAN_API_KEY');
    if (!url) {
      this.logger.warn('QIEMAN_MCP_URL not configured, MCP disabled');
      return;
    }
    await this.connect(url, apiKey);
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(url: string, apiKey?: string): Promise<void> {
    try {
      // MCP SDK exports map 未暴露 ./client/streamableHttp 子路径给 CJS，直接引用文件绕过
      const clientDir = join(require.resolve('@modelcontextprotocol/sdk/client'), '..');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { StreamableHTTPClientTransport } = require(join(clientDir, 'streamableHttp.js'));
      const transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: apiKey ? { headers: { 'X-Api-Key': apiKey } } : undefined,
      });
      this.client = new Client({ name: 'g-fund-agent', version: '1.0.0' });
      await this.client.connect(transport);
      this.connected = true;

      const result = await this.client.listTools();
      this.tools = result.tools;
      this.logger.log(`MCP connected, ${this.tools.length} tools available`);
    } catch (error) {
      this.logger.error(`MCP connection failed: ${(error as Error).message}`);
      this.connected = false;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connected = false;
      this.logger.log('MCP disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getTools(): Tool[] {
    return this.tools;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
    if (!this.client || !this.connected) {
      throw new Error('MCP not connected');
    }
    return this.client.callTool({ name, arguments: args }) as Promise<CallToolResult>;
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
}
