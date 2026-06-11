import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte, inArray, sql } from 'drizzle-orm';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { RulesService } from '../rules/rules.service';
import { MarketIndexService } from '../market-index/market-index.service';
import { SettingsService } from '../settings/settings.service';
import type {
  DcaCalculation,
  DcaSnapshot,
  DcaRules,
  FundRuleOverride,
  FundRuleOverrideType,
  ValuationLevel,
  AssetType,
  LifecycleStage,
} from '@g-fund/types';
import {
  calcP2,
  calcP3MonthlyAdjustment,
  calcP4,
  checkBiweeklyThursday,
  computeNextDcaDate,
  calcTFactorPriority,
  isOverrideEnabled,
} from './dca-calc';

type DbType = NodePgDatabase<typeof schema>;

const CSI300_CODE = 'sh000300';

@Injectable()
export class DcaService {
  private readonly logger = new Logger(DcaService.name);

  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly rulesService: RulesService,
    private readonly marketIndexService: MarketIndexService,
    private readonly settingsService: SettingsService,
  ) {}

  async calculate(): Promise<DcaCalculation[]> {
    const rules = await this.rulesService.getDcaRules();
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isBiweeklyThursday = checkBiweeklyThursday(rules.biweeklyAnchorDate);
    const nextDcaDate = computeNextDcaDate(rules.biweeklyAnchorDate);

    if (!isBiweeklyThursday) {
      return [];
    }

    const funds = await this.db.select().from(schema.funds);
    if (funds.length === 0) return [];

    const overrides = await this.loadAllOverrides(funds.map((f) => f.code));
    const positions = await this.db.select().from(schema.positions);
    const positionMap = new Map(positions.map((p) => [p.fundCode, p]));

    const p1 = await this.calcP1(rules);
    const tFactorBase = await this.calcTFactorBase(rules);
    const bulletReserve = await this.settingsService.getBulletReserve();
    const bulletTriggered = await this.checkBulletTrigger(bulletReserve.amount);

    const consecutiveP1Zero = await this.checkConsecutiveP1Zero();

    const calculations: DcaCalculation[] = [];

    for (const fund of funds) {
      const baseAmount = parseFloat(fund.baseAmount ?? '0');
      if (baseAmount <= 0) continue;

      const fundOverrides = overrides.get(fund.code) ?? [];
      const position = positionMap.get(fund.code);
      const assetType = (fund.assetType ?? 'equity') as AssetType;
      const valuationLevel = (fund.valuationLevel ?? fund.phase ?? 'normal') as ValuationLevel;
      const lifecycleStage = (fund.lifecycleStage ?? 'dca') as LifecycleStage;

      // 例外规则：暂停调速
      if (isOverrideEnabled(fundOverrides, 'pause_speed')) {
        calculations.push(this.buildSkippedResult(fund.code, fund.name, baseAmount, today, nextDcaDate, isBiweeklyThursday, '已暂停调速'));
        continue;
      }

      // 例外规则：固定金额
      const fixedOverride = fundOverrides.find((o) => o.overrideType === 'fixed_amount' && o.enabled);
      if (fixedOverride) {
        const fixedAmt = fixedOverride.value ?? baseAmount;
        calculations.push({
          fundCode: fund.code,
          fundName: fund.name,
          baseAmount: baseAmount.toFixed(2),
          valuationPercentile: fund.valuationPercentile ?? null,
          phase: valuationLevel as DcaCalculation['phase'],
          priority: fund.priority ?? 0,
          p0: 1,
          p1: 1,
          p2: 1,
          p3: 1,
          p4: 1,
          tFactor: 1,
          finalAmount: fixedAmt.toFixed(2),
          skipped: false,
          isBiweeklyThursday,
          nextDcaDate,
        });
        continue;
      }

      // P0: QDII 申购检查
      const p0 = this.calcP0(assetType);

      // P1: 当日大盘检查（连续 3 日推迟后强制执行）
      const effectiveP1 = consecutiveP1Zero >= 3 ? 1.0 : p1;

      // P2: 估值百分位系数
      const valuationPercentile = fund.valuationPercentile
        ? parseFloat(fund.valuationPercentile)
        : null;
      const p2 = valuationPercentile !== null
        ? calcP2(valuationPercentile, rules.valuationPercentiles)
        : 1.0;

      // P3: 估值水平系数 × 月涨幅调整系数
      const p3Base = rules.valuationLevelMultipliers[valuationLevel] ?? 1.0;
      const monthlyReturn = await this.calcMonthlyReturn(fund.code);
      const p3MonthlyAdj = calcP3MonthlyAdjustment(monthlyReturn);
      // 纯债不调速（P3 固定为 1.0）
      const p3 = assetType === 'bond' ? 1.0 : p3Base * p3MonthlyAdj;

      // P4: 优先级系数
      let priority = fund.priority ?? 0;
      const rebalanceAdj = this.calcRebalanceAdjustment();
      if (rebalanceAdj !== 0) {
        priority = Math.max(0, priority + rebalanceAdj);
      }
      const p4 = calcP4(priority, rules.priorityMultipliers);

      // T 因子: 大盘趋势 × 优先级调整
      const costAmount = position ? parseFloat(position.costAmount ?? '0') : 0;
      const targetAmt = parseFloat(fund.targetAmount ?? '0');
      const tFactorPriority = calcTFactorPriority(
        valuationPercentile,
        lifecycleStage,
        costAmount,
        targetAmt,
        monthlyReturn,
        rules,
      );
      const tFactor = tFactorBase * tFactorPriority;

      // 子弹仓加投
      const bulletAmount = bulletTriggered ? bulletReserve.amount : 0;

      // 最终金额
      let finalAmount = baseAmount * p0 * effectiveP1 * p2 * p3 * p4 * tFactor + bulletAmount;

      const maxAmount = baseAmount * rules.maxMultiplier + bulletAmount;
      if (finalAmount > maxAmount) {
        finalAmount = maxAmount;
      }

      const ratio = (finalAmount - bulletAmount) / baseAmount;
      const skipped = ratio < rules.minThreshold && bulletAmount === 0;

      calculations.push({
        fundCode: fund.code,
        fundName: fund.name,
        baseAmount: baseAmount.toFixed(2),
        valuationPercentile: fund.valuationPercentile ?? null,
        phase: valuationLevel as DcaCalculation['phase'],
        priority: fund.priority ?? 0,
        p0,
        p1: effectiveP1,
        p2,
        p3,
        p4,
        tFactor,
        finalAmount: finalAmount.toFixed(2),
        skipped,
        skipReason: skipped ? '定投金额低于基础金额的10%，跳过' : undefined,
        isBiweeklyThursday,
        nextDcaDate,
        rebalanceAdjustment: rebalanceAdj !== 0 ? rebalanceAdj : undefined,
        bulletReserveAmount: bulletAmount > 0 ? bulletAmount : undefined,
      });
    }

    // 写入快照
    await this.saveSnapshots(calculations, today);

    // 更新子弹仓触发日期
    if (bulletTriggered && calculations.some((c) => !c.skipped)) {
      await this.settingsService.setBulletReserve({
        amount: bulletReserve.amount,
        lastTriggeredDate: today,
      });
    }

    return calculations;
  }

  async calculateByFund(fundCode: string): Promise<DcaCalculation | null> {
    const allCalculations = await this.calculate();
    return allCalculations.find((c) => c.fundCode === fundCode) ?? null;
  }

  async getNextDcaDate(): Promise<{ nextDate: string; isToday: boolean }> {
    const rules = await this.rulesService.getDcaRules();
    const nextDate = computeNextDcaDate(rules.biweeklyAnchorDate);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { nextDate, isToday: nextDate === today };
  }

  // --- P0: QDII 申购检查（暂未接入 MCP，始终返回 1） ---

  private calcP0(_assetType: AssetType): number {
    return 1;
  }

  // --- P1: 当日大盘检查 ---

  private async calcP1(rules: DcaRules): Promise<number> {
    try {
      const quotes = await this.marketIndexService.fetchRealtime();
      const csi300 = quotes.find((q) => q.indexCode === CSI300_CODE);
      if (!csi300) return 1.0;

      const changePct = csi300.changePct;
      if (changePct > rules.p1Thresholds.up) return 0;
      if (changePct < rules.p1Thresholds.down) return 1.5;
      return 1.0;
    } catch {
      this.logger.warn('P1 大盘检查失败，默认通过');
      return 1.0;
    }
  }

  private async checkConsecutiveP1Zero(): Promise<number> {
    const recentSnapshots = await this.db
      .select()
      .from(schema.dcaSnapshots)
      .orderBy(desc(schema.dcaSnapshots.planDate))
      .limit(5);

    let count = 0;
    for (const snap of recentSnapshots) {
      if (snap.p1 !== null && parseFloat(snap.p1) === 0) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  // --- T 因子: 大盘趋势 ---

  private async calcTFactorBase(rules: DcaRules): Promise<number> {
    try {
      const history = await this.marketIndexService.fetchHistory(CSI300_CODE, 7);
      if (history.length < 2) return 1.0;

      const latest = parseFloat(history[0].close);
      const oldest = parseFloat(history[history.length - 1].close);
      if (oldest === 0) return 1.0;

      const cumulativeReturn = ((latest - oldest) / oldest) * 100;

      if (cumulativeReturn > rules.tFactorThresholds.bullMarket) return 0.5;
      if (cumulativeReturn < -rules.tFactorThresholds.bearMarket) return 1.3;
      return 1.0;
    } catch {
      this.logger.warn('T 因子大盘趋势检查失败，默认通过');
      return 1.0;
    }
  }

  // --- 月收益率实时计算 ---

  private async calcMonthlyReturn(fundCode: string): Promise<number | null> {
    try {
      const rows = await this.db
        .select({ navUnit: schema.fundNavHistory.navUnit, navDate: schema.fundNavHistory.navDate })
        .from(schema.fundNavHistory)
        .where(eq(schema.fundNavHistory.fundCode, fundCode))
        .orderBy(desc(schema.fundNavHistory.navDate))
        .limit(1);

      if (rows.length === 0) return null;
      const latestNav = parseFloat(rows[0].navUnit);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

      const [oldest] = await this.db
        .select({ navUnit: schema.fundNavHistory.navUnit })
        .from(schema.fundNavHistory)
        .where(
          and(
            eq(schema.fundNavHistory.fundCode, fundCode),
            gte(schema.fundNavHistory.navDate, cutoff),
          ),
        )
        .orderBy(schema.fundNavHistory.navDate)
        .limit(1);

      if (!oldest) return null;
      const oldestNav = parseFloat(oldest.navUnit);
      if (oldestNav === 0) return null;

      return (latestNav - oldestNav) / oldestNav;
    } catch {
      this.logger.warn(`计算 ${fundCode} 月收益率失败，返回 null`);
      return null;
    }
  }

  // --- 季度再平衡（暂未实现，返回 0） ---

  private calcRebalanceAdjustment(): number {
    return 0;
  }

  // --- 子弹仓 ---

  private async checkBulletTrigger(bulletAmount: number): Promise<boolean> {
    if (bulletAmount <= 0) return false;

    try {
      const history = await this.marketIndexService.fetchHistory(CSI300_CODE, 7);
      if (history.length < 2) return false;

      const latest = parseFloat(history[0].close);
      const oldest = parseFloat(history[history.length - 1].close);
      if (oldest === 0) return false;

      const weeklyReturn = ((latest - oldest) / oldest) * 100;

      // 沪深 300 单周跌 > -8%
      return weeklyReturn < -8;
    } catch {
      return false;
    }
  }

  // --- 例外规则 ---

  private async loadAllOverrides(fundCodes: string[]): Promise<Map<string, FundRuleOverride[]>> {
    const map = new Map<string, FundRuleOverride[]>();
    if (fundCodes.length === 0) return map;

    const rows = await this.db
      .select()
      .from(schema.fundRuleOverrides)
      .where(
        and(
          eq(schema.fundRuleOverrides.enabled, true),
          inArray(schema.fundRuleOverrides.fundCode, fundCodes),
        ),
      );

    for (const row of rows) {
      const existing = map.get(row.fundCode) ?? [];
      existing.push({
        fundCode: row.fundCode,
        overrideType: row.overrideType as FundRuleOverrideType,
        enabled: row.enabled,
        value: row.value !== null ? Number(row.value) : null,
        updatedAt: row.updatedAt.toISOString(),
      });
      map.set(row.fundCode, existing);
    }

    return map;
  }

  // --- 快照查询 ---

  async getSnapshots(planDate: string): Promise<DcaSnapshot[]> {
    const rows = await this.db
      .select()
      .from(schema.dcaSnapshots)
      .where(eq(schema.dcaSnapshots.planDate, planDate));

    return rows.map((row) => ({
      id: row.id,
      planDate: row.planDate,
      fundCode: row.fundCode,
      baseAmount: row.baseAmount,
      p0: row.p0,
      p1: row.p1,
      p2: row.p2,
      p3: row.p3,
      p4: row.p4,
      tFactor: row.tFactor,
      finalAmount: row.finalAmount,
      executed: row.executed,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markSnapshotExecuted(id: number): Promise<DcaSnapshot> {
    const [updated] = await this.db
      .update(schema.dcaSnapshots)
      .set({ executed: true })
      .where(eq(schema.dcaSnapshots.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Snapshot ${id} not found`);
    }

    return {
      id: updated.id,
      planDate: updated.planDate,
      fundCode: updated.fundCode,
      baseAmount: updated.baseAmount,
      p0: updated.p0,
      p1: updated.p1,
      p2: updated.p2,
      p3: updated.p3,
      p4: updated.p4,
      tFactor: updated.tFactor,
      finalAmount: updated.finalAmount,
      executed: updated.executed,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // --- 快照写入 ---

  private async saveSnapshots(calculations: DcaCalculation[], planDate: string): Promise<void> {
    if (calculations.length === 0) return;

    const values = calculations.map((calc) => ({
      planDate,
      fundCode: calc.fundCode,
      baseAmount: calc.baseAmount,
      p0: calc.p0.toFixed(4),
      p1: calc.p1.toFixed(4),
      p2: calc.p2.toFixed(4),
      p3: calc.p3.toFixed(4),
      p4: calc.p4.toFixed(4),
      tFactor: calc.tFactor.toFixed(4),
      finalAmount: calc.finalAmount,
      executed: false,
    }));

    await this.db
      .insert(schema.dcaSnapshots)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.dcaSnapshots.planDate, schema.dcaSnapshots.fundCode],
        set: {
          baseAmount: sql`excluded.base_amount`,
          p0: sql`excluded.p0`,
          p1: sql`excluded.p1`,
          p2: sql`excluded.p2`,
          p3: sql`excluded.p3`,
          p4: sql`excluded.p4`,
          tFactor: sql`excluded.t_factor`,
          finalAmount: sql`excluded.final_amount`,
        },
      });
  }

  private buildSkippedResult(
    fundCode: string,
    fundName: string,
    baseAmount: number,
    today: string,
    nextDcaDate: string,
    isBiweeklyThursday: boolean,
    reason: string,
  ): DcaCalculation {
    return {
      fundCode,
      fundName,
      baseAmount: baseAmount.toFixed(2),
      valuationPercentile: null,
      phase: null,
      priority: 0,
      p0: 1,
      p1: 1,
      p2: 1,
      p3: 1,
      p4: 1,
      tFactor: 1,
      finalAmount: '0.00',
      skipped: true,
      skipReason: reason,
      isBiweeklyThursday,
      nextDcaDate,
    };
  }
}
