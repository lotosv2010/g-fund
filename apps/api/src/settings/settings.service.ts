import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { FundsService } from '../funds/funds.service';
import { AppSetting } from '@g-fund/types';

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
}
