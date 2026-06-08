import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { PositionListItem } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;
type PositionRow = typeof schema.positions.$inferSelect;

function toListItem(row: PositionRow, currentValue: string): PositionListItem {
  const cost = parseFloat(row.costAmount ?? '0');
  const current = parseFloat(currentValue);
  const pnlAmount = (current - cost).toFixed(2);
  const pnlRate = cost > 0 ? ((current - cost) / cost).toFixed(4) : '0.0000';
  return {
    id: row.id,
    fundCode: row.fundCode,
    fundName: row.fundName,
    shares: row.shares ?? '0',
    costPrice: row.costPrice,
    costAmount: row.costAmount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    currentValue,
    pnlAmount,
    pnlRate,
  };
}

@Injectable()
export class PositionsService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async findAll(): Promise<PositionListItem[]> {
    const rows = await this.db.select().from(schema.positions);

    // positions 表为空时，降级读取 funds 表中已有的持仓数据
    if (rows.length === 0) {
      const holdingFunds = await this.db.select().from(schema.funds);

      return holdingFunds
        .filter((f) => parseFloat(f.costAmount ?? '0') > 0)
        .map((f) => {
          const cost = parseFloat(f.costAmount);
          const current = parseFloat(f.currentValue ?? '0');
          return {
            id: f.id,
            fundCode: f.code,
            fundName: f.name,
            shares: '0',
            costPrice: '0',
            costAmount: f.costAmount,
            createdAt: f.createdAt.toISOString(),
            updatedAt: f.updatedAt.toISOString(),
            currentValue: f.currentValue ?? '0',
            pnlAmount: (current - cost).toFixed(2),
            pnlRate: cost > 0 ? ((current - cost) / cost).toFixed(4) : '0.0000',
          };
        });
    }

    const fundCodes = rows.map((r) => r.fundCode);
    const funds = await this.db
      .select()
      .from(schema.funds)
      .where(inArray(schema.funds.code, fundCodes));

    const fundMap = new Map(funds.map((f) => [f.code, f]));

    return rows.map((row) => {
      const fund = fundMap.get(row.fundCode);
      const currentValue = fund?.currentValue ?? '0';
      return toListItem(row, currentValue);
    });
  }

  async findOne(fundCode: string): Promise<PositionListItem> {
    const [row] = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, fundCode));
    if (!row) throw new NotFoundException(`持仓 ${fundCode} 不存在`);

    const [fund] = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, fundCode));

    return toListItem(row, fund?.currentValue ?? '0');
  }
}
