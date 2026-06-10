import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { PositionListItem } from '@g-fund/types';
import { UpsertPositionDto } from './dto/upsert-position.dto';

type DbType = NodePgDatabase<typeof schema>;
type PositionRow = typeof schema.positions.$inferSelect;
type FundRow = typeof schema.funds.$inferSelect;

function toListItem(row: PositionRow, fund?: FundRow): PositionListItem {
  const cost = parseFloat(row.costAmount ?? '0');
  const current = parseFloat(row.currentValue ?? '0');
  const pnlAmount = (current - cost).toFixed(2);
  const pnlRate = cost > 0 ? ((current - cost) / cost).toFixed(4) : '0.0000';
  return {
    id: row.id,
    fundCode: row.fundCode,
    fundName: row.fundName,
    shares: row.shares ?? '0',
    costPrice: row.costPrice,
    costAmount: row.costAmount,
    currentValue: row.currentValue ?? '0',
    navUnit: row.navUnit ?? null,
    navDate: row.navDate ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pnlAmount,
    pnlRate,
    type: fund?.type ?? null,
    category: fund?.category ?? 'holding',
  };
}

@Injectable()
export class PositionsService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async findAll(): Promise<PositionListItem[]> {
    const rows = await this.db.select().from(schema.positions);
    if (rows.length === 0) return [];

    const fundCodes = rows.map((r) => r.fundCode);
    const funds = await this.db
      .select()
      .from(schema.funds)
      .where(inArray(schema.funds.code, fundCodes));
    const fundMap = new Map(funds.map((f) => [f.code, f]));

    return rows.map((row) => toListItem(row, fundMap.get(row.fundCode)));
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

    return toListItem(row, fund);
  }

  async upsertSnapshot(dto: UpsertPositionDto): Promise<PositionListItem> {
    const [fund] = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, dto.fundCode));
    if (!fund) throw new NotFoundException(`基金 ${dto.fundCode} 不存在`);

    const txCount = await this.countTransactions(dto.fundCode);
    if (txCount > 0) {
      throw new ConflictException(
        `基金 ${dto.fundCode} 已有交易流水，请通过买入/卖出维护持仓，不要直接录入快照`,
      );
    }

    const costAmount = parseFloat(dto.costAmount);
    const costPrice = parseFloat(dto.costPrice);
    if (!Number.isFinite(costAmount) || costAmount <= 0) {
      throw new BadRequestException('持仓金额必须大于 0');
    }
    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      throw new BadRequestException('成本净值必须大于 0');
    }
    const shares = costAmount / costPrice;

    const [existing] = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, dto.fundCode));

    let row: PositionRow;
    if (existing) {
      [row] = await this.db
        .update(schema.positions)
        .set({
          fundName: fund.name,
          shares: shares.toFixed(4),
          costPrice: costPrice.toFixed(4),
          costAmount: costAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.positions.fundCode, dto.fundCode))
        .returning();
    } else {
      [row] = await this.db
        .insert(schema.positions)
        .values({
          fundCode: dto.fundCode,
          fundName: fund.name,
          shares: shares.toFixed(4),
          costPrice: costPrice.toFixed(4),
          costAmount: costAmount.toFixed(2),
          currentValue: '0',
        })
        .returning();
    }

    return toListItem(row, fund);
  }

  async remove(fundCode: string): Promise<void> {
    const [position] = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, fundCode));
    if (!position) throw new NotFoundException(`持仓 ${fundCode} 不存在`);

    const txCount = await this.countTransactions(fundCode);
    if (txCount > 0) {
      throw new ConflictException(`基金 ${fundCode} 已有交易流水，无法直接清仓，请先删除流水`);
    }

    await this.db.delete(schema.positions).where(eq(schema.positions.fundCode, fundCode));
  }

  private async countTransactions(fundCode: string): Promise<number> {
    const rows = await this.db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(eq(schema.transactions.fundCode, fundCode));
    return rows.length;
  }
}
