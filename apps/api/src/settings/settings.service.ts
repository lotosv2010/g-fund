import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { FundsService } from '../funds/funds.service';
import { McpService } from '../mcp/mcp.service';
import { AppSetting, AiConfig, McpConfig, BulletReserve, DEFAULT_AI_CONFIG, DEFAULT_MCP_CONFIG } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

function toAppSetting(row: typeof schema.appSettings.$inferSelect): AppSetting {
  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly fundsService: FundsService,
    private readonly mcpService: McpService,
  ) {}

  async get(key: string): Promise<AppSetting> {
    const [row] = await this.db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key));
    if (!row) throw new NotFoundException(`配置 ${key} 不存在`);
    return toAppSetting(row);
  }

  async set(key: string, value: string): Promise<AppSetting> {
    const [row] = await this.db
      .insert(schema.appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();

    if (key === 'target_total_position') {
      await this.fundsService.recalcTargetAmounts(value);
    }

    return toAppSetting(row);
  }

  async getAiConfig(): Promise<AiConfig> {
    try {
      const setting = await this.get('ai_config');
      return JSON.parse(setting.value) as AiConfig;
    } catch {
      return DEFAULT_AI_CONFIG;
    }
  }

  async setAiConfig(config: AiConfig): Promise<AppSetting> {
    return this.set('ai_config', JSON.stringify(config));
  }

  async getMcpConfig(): Promise<McpConfig> {
    try {
      const setting = await this.get('mcp_config');
      return JSON.parse(setting.value) as McpConfig;
    } catch {
      return DEFAULT_MCP_CONFIG;
    }
  }

  async setMcpConfig(config: McpConfig): Promise<AppSetting> {
    const result = await this.set('mcp_config', JSON.stringify(config));
    await this.mcpService.reconnectAll(config);
    return result;
  }

  async getBulletReserve(): Promise<BulletReserve> {
    try {
      const setting = await this.get('bullet_reserve');
      return JSON.parse(setting.value) as BulletReserve;
    } catch {
      return { amount: 0, lastTriggeredDate: null };
    }
  }

  async setBulletReserve(reserve: BulletReserve): Promise<AppSetting> {
    return this.set('bullet_reserve', JSON.stringify(reserve));
  }
}
