import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte } from 'drizzle-orm';
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
    const today = new Date().toISOString().split('T')[0];
    const isBiweeklyThursday = this.checkBiweeklyThursday(rules.biweeklyAnchorDate);
    const nextDcaDate = this.computeNextDcaDate(rules.biweeklyAnchorDate);

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
      if (this.isOverrideEnabled(fundOverrides, 'pause_speed')) {
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
      const p0 = await this.calcP0(assetType);

      // P1: 当日大盘检查（连续 3 日推迟后强制执行）
      const effectiveP1 = consecutiveP1Zero >= 3 ? 1.0 : p1;

      // P2: 估值百分位系数
      const valuationPercentile = fund.valuationPercentile
        ? parseFloat(fund.valuationPercentile)
        : null;
      const p2 = valuationPercentile !== null
        ? this.calcP2(valuationPercentile, rules.valuationPercentiles)
        : 1.0;

      // P3: 估值水平系数 × 月涨幅调整系数
      const p3Base = rules.valuationLevelMultipliers[valuationLevel] ?? 1.0;
      const monthlyReturn = fund.monthlyReturn ? parseFloat(fund.monthlyReturn) : null;
      const p3MonthlyAdj = this.calcP3MonthlyAdjustment(monthlyReturn);
      // 纯债不调速（P3 固定为 1.0）
      const p3 = assetType === 'bond' ? 1.0 : p3Base * p3MonthlyAdj;

      // P4: 优先级系数
      let priority = fund.priority ?? 0;
      const rebalanceAdj = this.calcRebalanceAdjustment(fund, position, today);
      if (rebalanceAdj !== 0) {
        priority = Math.max(0, priority + rebalanceAdj);
      }
      const p4 = this.calcP4(priority, rules.priorityMultipliers);

      // T 因子: 大盘趋势 × 优先级调整
      const tFactorPriority = this.calcTFactorPriority(
        valuationPercentile,
        lifecycleStage,
        position,
        fund.targetAmount,
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
    const nextDate = this.computeNextDcaDate(rules.biweeklyAnchorDate);
    const today = new Date().toISOString().split('T')[0];
    return { nextDate, isToday: nextDate === today };
  }

  // --- Biweekly Thursday ---

  private checkBiweeklyThursday(anchorDate: string): boolean {
    const today = new Date();
    const anchor = new Date(anchorDate);
    const diffDays = Math.floor((today.getTime() - anchor.getTime()) / 86_400_000);
    const dayOfWeek = today.getDay();
    return dayOfWeek === 4 && diffDays % 14 === 0 && diffDays >= 0;
  }

  private computeNextDcaDate(anchorDate: string): string {
    const today = new Date();
    const anchor = new Date(anchorDate);
    const diffDays = Math.floor((today.getTime() - anchor.getTime()) / 86_400_000);

    if (diffDays < 0) return anchorDate;

    const cyclesElapsed = Math.floor(diffDays / 14);
    let next = new Date(anchor);
    next.setDate(next.getDate() + (cyclesElapsed + 1) * 14);

    // 如果今天就是双周四，返回今天
    if (today.getDay() === 4 && diffDays % 14 === 0) {
      return today.toISOString().split('T')[0];
    }

    return next.toISOString().split('T')[0];
  }

  // --- P0: QDII 申购检查 ---

  private async calcP0(assetType: AssetType): Promise<number> {
    if (assetType !== 'qdii') return 1;

    try {
      // 调用盈米 MCP 检查 QDII 申购限额
      // BatchGetFundTradeLimit 工具需要通过 McpService 调用
      // 由于 McpService 是 @Global() 模块，但 DcaModule 未直接注入
      // 此处通过数据库查询 fund_rule_overrides 中的 qdii_allot 标记
      // 实际 MCP 调用在后续 Agent 工具层集成
      return 1;
    } catch {
      this.logger.warn('QDII 申购检查失败，默认允许申购');
      return 1;
    }
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

  private calcTFactorPriority(
    valuationPercentile: number | null,
    lifecycleStage: LifecycleStage,
    position: typeof schema.positions.$inferSelect | undefined,
    targetAmount: string | null,
    monthlyReturn: number | null,
    rules: DcaRules,
  ): number {
    const costAmount = position ? parseFloat(position.costAmount ?? '0') : 0;
    const target = parseFloat(targetAmount ?? '0');
    const progress = target > 0 ? costAmount / target : 0;

    // 超配：持仓 / 目标 > 100%
    if (progress > 1.0) return 0;

    // 接近止盈：收益率 > 20%（距止盈第一档 25% 差距 5% 以内）
    if (monthlyReturn !== null && monthlyReturn > 0.20) return 0.5;

    // 低估 + 大缺口：估值百分位 < 20% 且持仓 / 目标 < 50%
    if (valuationPercentile !== null && valuationPercentile < 20 && progress < 0.5) return 1.2;

    return 1.0;
  }

  // --- P2: 估值百分位系数 ---

  private calcP2(percentile: number, rules: Array<{ max: number; multiplier: number }>): number {
    for (const rule of rules) {
      if (percentile <= rule.max) return rule.multiplier;
    }
    return rules[rules.length - 1]?.multiplier ?? 1.0;
  }

  // --- P3: 月涨幅调整系数 ---

  private calcP3MonthlyAdjustment(monthlyReturn: number | null): number {
    if (monthlyReturn === null) return 1.0;
    if (monthlyReturn > 0.20) return 0;
    if (monthlyReturn > 0.10) return 0.5;
    if (monthlyReturn < -0.10) return 1.5;
    if (monthlyReturn < -0.05) return 1.3;
    return 1.0;
  }

  // --- P4: 优先级系数 ---

  private calcP4(priority: number, rules: Array<{ minPriority: number; multiplier: number }>): number {
    for (const rule of rules) {
      if (priority >= rule.minPriority) return rule.multiplier;
    }
    return rules[rules.length - 1]?.multiplier ?? 1.0;
  }

  // --- 季度再平衡 ---

  private calcRebalanceAdjustment(
    fund: typeof schema.funds.$inferSelect,
    position: typeof schema.positions.$inferSelect | undefined,
    today: string,
  ): number {
    const month = new Date(today).getMonth() + 1;
    const isFirstDcaOfMonth = this.isFirstDcaOfMonth(today);
    if (![3, 6, 9, 12].includes(month) || !isFirstDcaOfMonth) return 0;

    const costAmount = position ? parseFloat(position.costAmount ?? '0') : 0;
    const targetRatio = parseFloat(fund.targetRatio ?? '0');
    if (targetRatio <= 0 || costAmount <= 0) return 0;

    // 计算实际占比需要总资产，此处简化：用 costAmount / sum(all costAmount)
    // 实际偏差在 calculate() 中批量计算更准确
    // 这里用一个简化版本：targetRatio 作为基准
    return 0;
  }

  private isFirstDcaOfMonth(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date.getDate() <= 7;
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

  private isOverrideEnabled(overrides: FundRuleOverride[], type: FundRuleOverrideType): boolean {
    return overrides.some((o) => o.overrideType === type && o.enabled);
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
    for (const calc of calculations) {
      await this.db
        .insert(schema.dcaSnapshots)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [schema.dcaSnapshots.planDate, schema.dcaSnapshots.fundCode],
          set: {
            baseAmount: calc.baseAmount,
            p0: calc.p0.toFixed(4),
            p1: calc.p1.toFixed(4),
            p2: calc.p2.toFixed(4),
            p3: calc.p3.toFixed(4),
            p4: calc.p4.toFixed(4),
            tFactor: calc.tFactor.toFixed(4),
            finalAmount: calc.finalAmount,
          },
        });
    }
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
