import { Injectable, Inject, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, asc, inArray, SQL, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { CreateFundDto } from './dto/create-fund.dto';
import { UpdateFundDto } from './dto/update-fund.dto';
import { FundListItem, LifecycleStage, StageChange } from '@g-fund/types';
import { FundEnrichmentService } from './fund-enrichment.service';

const STAGE_THRESHOLD = 0.8;

export interface StageInfo {
  lifecycleStage: LifecycleStage;
  stageChangedAt: string | null;
  progress: number;
  stageChanged: boolean;
  previousStage: LifecycleStage | null;
}

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
    category: (r.category ?? 'all') as FundListItem['category'],
    sortOrder: Number(r.sortOrder ?? 0),
    targetAmount: r.targetAmount ?? '0',
    targetRatio: r.targetRatio ?? '0',
    valuationPercentile: r.valuationPercentile ?? null,
    phase: (r.phase as FundListItem['phase']) ?? null,
    valuationLevel: (r.valuationLevel as FundListItem['valuationLevel']) ?? null,
    lifecycleStage: (r.lifecycleStage as FundListItem['lifecycleStage']) ?? 'dca',
    assetType: (r.assetType as FundListItem['assetType']) ?? 'equity',
    stageChangedAt: r.stageChangedAt ? r.stageChangedAt.toISOString() : null,
    priority: Number(r.priority ?? 0),
    baseAmount: r.baseAmount ?? '0',
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
  private readonly logger = new Logger(FundsService.name);

  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly enrichmentService: FundEnrichmentService,
  ) {}

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

    const valuationLevel = dto.valuationLevel ?? dto.phase ?? 'normal';
    const [row] = await this.db
      .insert(schema.funds)
      .values({
        code: dto.code,
        name: dto.name,
        type: dto.type ?? null,
        riskLevel: dto.riskLevel ?? null,
        category: dto.category ?? 'all',
        targetAmount,
        targetRatio: dto.targetRatio ?? '0',
        valuationPercentile: dto.valuationPercentile ?? null,
        phase: valuationLevel,
        valuationLevel,
        lifecycleStage: dto.lifecycleStage ?? 'dca',
        assetType: dto.assetType ?? 'equity',
        priority: dto.priority ?? 0,
        baseAmount: dto.baseAmount ?? '0',
        note: dto.note ?? null,
      })
      .returning();

    // 异步丰富资产类型（不阻塞返回）
    if (!dto.assetType) {
      this.enrichmentService.enrichAssetType(dto.code, dto.name).catch((err) => {
        this.logger.warn(`资产类型丰富失败 ${dto.code}: ${(err as Error).message}`);
      });
    }

    return toListItem(row);
  }

  async update(code: string, dto: UpdateFundDto): Promise<FundListItem> {
    await this.findOne(code);

    let targetAmount: string | undefined;
    if (dto.targetRatio !== undefined) {
      const total = await this.getTargetTotalPosition();
      targetAmount = (total * parseFloat(dto.targetRatio) / 100).toFixed(2);
    }

    const updateData: Record<string, unknown> = {
      ...dto,
      ...(targetAmount !== undefined ? { targetAmount } : {}),
      updatedAt: new Date(),
    };

    // 双写 phase ↔ valuationLevel：任一字段被改时同步另一边（M11 后移除）
    if (dto.valuationLevel !== undefined && dto.phase === undefined) {
      updateData.phase = dto.valuationLevel;
    } else if (dto.phase !== undefined && dto.valuationLevel === undefined) {
      updateData.valuationLevel = dto.phase;
    }

    // Convert sortOrder from number to string for Drizzle
    if (dto.sortOrder !== undefined) {
      updateData.sortOrder = String(dto.sortOrder);
    }

    const [row] = await this.db
      .update(schema.funds)
      .set(updateData)
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
    if (items.length === 0) return;

    await this.db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(schema.funds)
          .set({ sortOrder: String(item.sortOrder), updatedAt: new Date() })
          .where(eq(schema.funds.code, item.code));
      }
    });
  }

  async recalcTargetAmounts(totalPosition: string): Promise<void> {
    const total = parseFloat(totalPosition);
    const allFunds = await this.db.select().from(schema.funds);
    if (allFunds.length === 0) return;

    await this.db.transaction(async (tx) => {
      for (const fund of allFunds) {
        const ratio = parseFloat(fund.targetRatio ?? '0');
        const targetAmount = (total * ratio / 100).toFixed(2);
        await tx
          .update(schema.funds)
          .set({ targetAmount, updatedAt: new Date() })
          .where(eq(schema.funds.code, fund.code));
      }
    });

    await this.recomputeAllStages();
  }

  async computeLifecycleStage(fundCode: string): Promise<StageInfo> {
    const [fund] = await this.db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.code, fundCode));
    if (!fund) throw new NotFoundException(`基金 ${fundCode} 不存在`);

    const [position] = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.fundCode, fundCode));

    const costAmount = position ? parseFloat(position.costAmount ?? '0') : 0;
    const targetAmount = parseFloat(fund.targetAmount ?? '0');
    const progress = targetAmount > 0 ? costAmount / targetAmount : 0;
    const computedStage: LifecycleStage = progress >= STAGE_THRESHOLD ? 'holding' : 'dca';
    const stageChanged = fund.lifecycleStage !== computedStage;
    const previousStage = fund.lifecycleStage as LifecycleStage;

    if (stageChanged) {
      await this.db
        .update(schema.funds)
        .set({
          lifecycleStage: computedStage,
          stageChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.funds.code, fundCode));
    }

    return {
      lifecycleStage: computedStage,
      stageChangedAt: fund.stageChangedAt ? fund.stageChangedAt.toISOString() : null,
      progress: Math.round(progress * 10000) / 100,
      stageChanged,
      previousStage: stageChanged ? previousStage : null,
    };
  }

  async recomputeAllStages(): Promise<void> {
    const funds = await this.db.select().from(schema.funds);
    if (funds.length === 0) return;

    const positions = await this.db.select().from(schema.positions);
    const positionMap = new Map(positions.map((p) => [p.fundCode, p]));

    await this.db.transaction(async (tx) => {
      for (const fund of funds) {
        const position = positionMap.get(fund.code);
        const costAmount = position ? parseFloat(position.costAmount ?? '0') : 0;
        const targetAmount = parseFloat(fund.targetAmount ?? '0');
        const progress = targetAmount > 0 ? costAmount / targetAmount : 0;
        const computedStage: LifecycleStage = progress >= STAGE_THRESHOLD ? 'holding' : 'dca';

        if (fund.lifecycleStage !== computedStage) {
          await tx
            .update(schema.funds)
            .set({
              lifecycleStage: computedStage,
              stageChangedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.funds.code, fund.code));
        }
      }
    });
  }

  async recordStageChange(
    fundCode: string,
    fundName: string,
    fromStage: LifecycleStage,
    toStage: LifecycleStage,
    progress: number,
    trigger: StageChange['trigger'],
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const change: StageChange = {
      fundCode,
      fundName,
      fromStage,
      toStage,
      progress,
      trigger,
      timestamp: new Date().toISOString(),
    };

    const [existing] = await this.db
      .select()
      .from(schema.dailyLogs)
      .where(eq(schema.dailyLogs.logDate, today));

    if (existing) {
      const currentChanges = (existing.stageChanges as StageChange[]) || [];
      await this.db
        .update(schema.dailyLogs)
        .set({
          stageChanges: [...currentChanges, change],
          updatedAt: new Date(),
        })
        .where(eq(schema.dailyLogs.logDate, today));
    } else {
      await this.db
        .insert(schema.dailyLogs)
        .values({
          logDate: today,
          stageChanges: [change],
        });
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
