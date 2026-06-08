import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { CreateFundDto } from './dto/create-fund.dto';
import { UpdateFundDto } from './dto/update-fund.dto';
import { FundListItem } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;
type FundRow = typeof schema.funds.$inferSelect;

function toListItem(r: FundRow): FundListItem {
  const cost = parseFloat(r.costAmount ?? '0');
  const current = parseFloat(r.currentValue ?? '0');
  const pnlAmount = (current - cost).toFixed(2);
  const pnlRate = cost > 0 ? ((current - cost) / cost).toFixed(4) : '0.0000';
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type ?? null,
    riskLevel: r.riskLevel ?? null,
    costAmount: r.costAmount ?? '0',
    currentValue: r.currentValue ?? '0',
    targetAmount: r.targetAmount ?? '0',
    targetRatio: r.targetRatio ?? '0',
    note: r.note ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    pnlAmount,
    pnlRate,
  };
}

@Injectable()
export class FundsService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async findAll(): Promise<FundListItem[]> {
    const rows = await this.db.select().from(schema.funds);
    return rows.map(toListItem);
  }

  async findOne(code: string): Promise<FundListItem> {
    const [row] = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, code));
    if (!row) throw new NotFoundException(`基金 ${code} 不存在`);
    return toListItem(row);
  }

  async create(dto: CreateFundDto): Promise<FundListItem> {
    const existing = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, dto.code));
    if (existing.length > 0) throw new ConflictException(`基金 ${dto.code} 已存在`);

    const [row] = await this.db
      .insert(schema.funds)
      .values({
        code: dto.code,
        name: dto.name,
        type: dto.type ?? null,
        riskLevel: dto.riskLevel ?? null,
        costAmount: dto.costAmount ?? '0',
        currentValue: dto.currentValue ?? '0',
        targetAmount: dto.targetAmount ?? '0',
        targetRatio: dto.targetRatio ?? '0',
        note: dto.note ?? null,
      })
      .returning();
    return toListItem(row);
  }

  async update(code: string, dto: UpdateFundDto): Promise<FundListItem> {
    await this.findOne(code);
    const [row] = await this.db
      .update(schema.funds)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.funds.code, code))
      .returning();
    return toListItem(row);
  }

  async remove(code: string): Promise<void> {
    await this.findOne(code);
    await this.db.delete(schema.funds).where(eq(schema.funds.code, code));
  }
}
