import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { UpdateDailyLogDto } from './dto/update-daily-log.dto';
import type { DailyLog } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;
type DailyLogRow = typeof schema.dailyLogs.$inferSelect;

function toDailyLog(r: DailyLogRow): DailyLog {
  return {
    id: r.id,
    logDate: r.logDate,
    summary: r.summary ?? null,
    marketNote: r.marketNote ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class DailyLogsService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async findAll(from?: string, to?: string): Promise<DailyLog[]> {
    const conditions: SQL[] = [];
    if (from) conditions.push(gte(schema.dailyLogs.logDate, from));
    if (to) conditions.push(lte(schema.dailyLogs.logDate, to));

    const base = conditions.length > 0
      ? this.db.select().from(schema.dailyLogs).where(and(...conditions))
      : this.db.select().from(schema.dailyLogs);

    const rows = await base.orderBy(desc(schema.dailyLogs.logDate));
    return rows.map(toDailyLog);
  }

  async findOne(id: number): Promise<DailyLog> {
    const [row] = await this.db
      .select()
      .from(schema.dailyLogs)
      .where(eq(schema.dailyLogs.id, id));
    if (!row) throw new NotFoundException(`日志 #${id} 不存在`);
    return toDailyLog(row);
  }

  async create(dto: CreateDailyLogDto): Promise<DailyLog> {
    const [row] = await this.db
      .insert(schema.dailyLogs)
      .values({
        logDate: dto.logDate,
        summary: dto.summary ?? null,
        marketNote: dto.marketNote ?? null,
      })
      .onConflictDoUpdate({
        target: schema.dailyLogs.logDate,
        set: {
          summary: dto.summary ?? null,
          marketNote: dto.marketNote ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toDailyLog(row);
  }

  async update(id: number, dto: UpdateDailyLogDto): Promise<DailyLog> {
    await this.findOne(id);
    const [row] = await this.db
      .update(schema.dailyLogs)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.dailyLogs.id, id))
      .returning();
    return toDailyLog(row);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.delete(schema.dailyLogs).where(eq(schema.dailyLogs.id, id));
  }
}
