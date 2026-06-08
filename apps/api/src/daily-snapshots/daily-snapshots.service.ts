import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, desc, inArray, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import type { DailySnapshot, PositionSnapshotItem } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;
type SnapshotRow = typeof schema.dailySnapshots.$inferSelect;

function toSnapshot(r: SnapshotRow): DailySnapshot {
  return {
    id: r.id,
    snapshotDate: r.snapshotDate,
    totalCost: r.totalCost ?? '0',
    totalValue: r.totalValue ?? '0',
    totalPnl: r.totalPnl ?? '0',
    pnlRatio: r.pnlRatio ?? '0',
    positionCount: r.positionCount ?? 0,
    positionsSnapshot: (r.positionsSnapshot as PositionSnapshotItem[] | null) ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class DailySnapshotsService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async findAll(from?: string, to?: string): Promise<DailySnapshot[]> {
    const conditions: SQL[] = [];
    if (from) conditions.push(gte(schema.dailySnapshots.snapshotDate, from));
    if (to) conditions.push(lte(schema.dailySnapshots.snapshotDate, to));

    const base = conditions.length > 0
      ? this.db.select().from(schema.dailySnapshots).where(and(...conditions))
      : this.db.select().from(schema.dailySnapshots);

    const rows = await base.orderBy(desc(schema.dailySnapshots.snapshotDate));
    return rows.map(toSnapshot);
  }

  async findOne(date: string): Promise<DailySnapshot> {
    const [row] = await this.db
      .select()
      .from(schema.dailySnapshots)
      .where(eq(schema.dailySnapshots.snapshotDate, date));
    if (!row) throw new NotFoundException(`${date} 的快照不存在`);
    return toSnapshot(row);
  }

  async generate(): Promise<DailySnapshot> {
    const today = new Date().toISOString().slice(0, 10);

    const posRows = await this.db.select().from(schema.positions);
    let items: PositionSnapshotItem[] = [];
    let totalCost = 0;
    let totalValue = 0;

    if (posRows.length > 0) {
      const fundCodes = posRows.map((r) => r.fundCode);
      const funds = await this.db
        .select()
        .from(schema.funds)
        .where(inArray(schema.funds.code, fundCodes));
      const fundMap = new Map(funds.map((f) => [f.code, f]));

      items = posRows.map((pos) => {
        const fund = fundMap.get(pos.fundCode);
        const cost = parseFloat(pos.costAmount ?? '0');
        const current = parseFloat(fund?.currentValue ?? '0');
        const pnl = current - cost;
        totalCost += cost;
        totalValue += current;
        return {
          fundCode: pos.fundCode,
          fundName: pos.fundName,
          shares: pos.shares ?? '0',
          costAmount: pos.costAmount ?? '0',
          currentValue: fund?.currentValue ?? '0',
          pnlAmount: pnl.toFixed(2),
          pnlRate: cost > 0 ? (pnl / cost).toFixed(4) : '0.0000',
        };
      });
    } else {
      // positions 为空时降级读 funds
      const holdingFunds = await this.db
        .select()
        .from(schema.funds)
        .where(eq(schema.funds.category, 'holding'));

      items = holdingFunds
        .filter((f) => parseFloat(f.costAmount ?? '0') > 0)
        .map((f) => {
          const cost = parseFloat(f.costAmount);
          const current = parseFloat(f.currentValue ?? '0');
          const pnl = current - cost;
          totalCost += cost;
          totalValue += current;
          return {
            fundCode: f.code,
            fundName: f.name,
            shares: '0',
            costAmount: f.costAmount,
            currentValue: f.currentValue ?? '0',
            pnlAmount: pnl.toFixed(2),
            pnlRate: cost > 0 ? (pnl / cost).toFixed(4) : '0.0000',
          };
        });
    }

    const totalPnl = totalValue - totalCost;
    const pnlRatio = totalCost > 0 ? totalPnl / totalCost : 0;

    const [row] = await this.db
      .insert(schema.dailySnapshots)
      .values({
        snapshotDate: today,
        totalCost: totalCost.toFixed(2),
        totalValue: totalValue.toFixed(2),
        totalPnl: totalPnl.toFixed(2),
        pnlRatio: pnlRatio.toFixed(4),
        positionCount: items.length,
        positionsSnapshot: items,
      })
      .onConflictDoUpdate({
        target: schema.dailySnapshots.snapshotDate,
        set: {
          totalCost: totalCost.toFixed(2),
          totalValue: totalValue.toFixed(2),
          totalPnl: totalPnl.toFixed(2),
          pnlRatio: pnlRatio.toFixed(4),
          positionCount: items.length,
          positionsSnapshot: items,
        },
      })
      .returning();

    return toSnapshot(row);
  }
}
