import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, asc, inArray, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { CreateFundDto } from './dto/create-fund.dto';
import { UpdateFundDto } from './dto/update-fund.dto';
import { FundListItem } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;
type FundRow = typeof schema.funds.$inferSelect;
type PositionRow = typeof schema.positions.$inferSelect;

function toListItem(r: FundRow, position?: PositionRow): FundListItem {
  const costAmount = position?.costAmount ?? '0';
  const currentValue = position?.currentValue ?? '0';
  const cost = parseFloat(costAmount);
  const current = parseFloat(currentValue);
  const pnlAmount = (current - cost).toFixed(2);
  const pnlRate = cost > 0 ? ((current - cost) / cost).toFixed(4) : '0.0000';
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type ?? null,
    riskLevel: r.riskLevel ?? null,
    category: (r.category ?? 'holding') as FundListItem['category'],
    sortOrder: Number(r.sortOrder ?? 0),
    targetAmount: r.targetAmount ?? '0',
    targetRatio: r.targetRatio ?? '0',
    note: r.note ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    costAmount,
    currentValue,
    pnlAmount,
    pnlRate,
    hasPosition: !!position,
  };
}

@Injectable()
export class FundsService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async findAll(category?: string): Promise<FundListItem[]> {
    const conditions: SQL[] = [];
    if (category) {
      conditions.push(eq(schema.funds.category, category));
    }
    const base = conditions.length > 0
      ? this.db.select().from(schema.funds).where(conditions[0])
      : this.db.select().from(schema.funds);
    const rows = await base.orderBy(asc(schema.funds.sortOrder));

    if (rows.length === 0) return [];

    const positions = await this.db
      .select()
      .from(schema.positions)
      .where(inArray(schema.positions.fundCode, rows.map((r) => r.code)));
    const positionMap = new Map(positions.map((p) => [p.fundCode, p]));

    return rows.map((r) => toListItem(r, positionMap.get(r.code)));
  }

  async findOne(code: string): Promise<FundListItem> {
    const [row] = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, code));
    if (!row) throw new NotFoundException(`基金 ${code} 不存在`);
    const [position] = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, code));
    return toListItem(row, position);
  }

  async create(dto: CreateFundDto): Promise<FundListItem> {
    const existing = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, dto.code));
    if (existing.length > 0) throw new ConflictException(`基金 ${dto.code} 已存在`);

    let targetAmount = dto.targetAmount ?? '0';
    if (dto.targetRatio) {
      const total = await this.getTargetTotalPosition();
      targetAmount = (total * parseFloat(dto.targetRatio) / 100).toFixed(2);
    }

    const [row] = await this.db
      .insert(schema.funds)
      .values({
        code: dto.code,
        name: dto.name,
        type: dto.type ?? null,
        riskLevel: dto.riskLevel ?? null,
        category: dto.category ?? 'holding',
        targetAmount,
        targetRatio: dto.targetRatio ?? '0',
        note: dto.note ?? null,
      })
      .returning();
    return toListItem(row);
  }

  async update(code: string, dto: UpdateFundDto): Promise<FundListItem> {
    await this.findOne(code);

    let targetAmount: string | undefined;
    if (dto.targetRatio !== undefined) {
      const total = await this.getTargetTotalPosition();
      targetAmount = (total * parseFloat(dto.targetRatio) / 100).toFixed(2);
    }

    const [row] = await this.db
      .update(schema.funds)
      .set({
        ...dto,
        ...(targetAmount !== undefined ? { targetAmount } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.funds.code, code))
      .returning();

    if (dto.name !== undefined) {
      await this.db
        .update(schema.positions)
        .set({ fundName: dto.name, updatedAt: new Date() })
        .where(eq(schema.positions.fundCode, code));
    }

    const [position] = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, code));
    return toListItem(row, position);
  }

  async remove(code: string): Promise<void> {
    await this.findOne(code);
    await this.db.delete(schema.funds).where(eq(schema.funds.code, code));
  }

  async reorder(items: { code: string; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await this.db
        .update(schema.funds)
        .set({ sortOrder: String(item.sortOrder), updatedAt: new Date() })
        .where(eq(schema.funds.code, item.code));
    }
  }

  async recalcTargetAmounts(totalPosition: string): Promise<void> {
    const total = parseFloat(totalPosition);
    const allFunds = await this.db.select().from(schema.funds);
    for (const fund of allFunds) {
      const ratio = parseFloat(fund.targetRatio ?? '0');
      const targetAmount = (total * ratio / 100).toFixed(2);
      await this.db
        .update(schema.funds)
        .set({ targetAmount, updatedAt: new Date() })
        .where(eq(schema.funds.code, fund.code));
    }
  }

  private async getTargetTotalPosition(): Promise<number> {
    const [row] = await this.db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'target_total_position'));
    return row ? parseFloat(row.value) : 0;
  }
}
