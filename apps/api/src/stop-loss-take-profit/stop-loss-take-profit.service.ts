import { Injectable, Inject } from '@nestjs/common';
import { eq, ne, and, gte, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { RulesService } from '../rules/rules.service';
import { RealtimeQuoteService } from '../realtime-quote/realtime-quote.service';
import {
  StopLossTakeProfitSignal,
  SignalLevel,
  DeepLossDecision,
  LifecycleStage,
  SlpRules,
  FundRuleOverride,
} from '@g-fund/types';
import { computeAlertSignal, computeNextTierGap, isLowValuationIndex } from './slp-calc';

type DbType = NodePgDatabase<typeof schema>;

interface DeepLossContext {
  fundCode: string;
  fundName: string;
  costPrice: number;
  currentPrice: number;
  pnlRate: number;
  valuationPercentile: number | null;
  lifecycleStage: LifecycleStage;
  recentWatchDays: number;
  recentPnlTrend: number[];
}

@Injectable()
export class StopLossTakeProfitService {
  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly rulesService: RulesService,
    private readonly realtimeQuoteService: RealtimeQuoteService,
  ) {}

  async getSignals(): Promise<StopLossTakeProfitSignal[]> {
    const rules = await this.rulesService.getSlpRules();

    const positions = await this.db
      .select()
      .from(schema.positions)
      .where(ne(schema.positions.shares, '0'));

    const funds = await this.db.select().from(schema.funds);
    const fundMap = new Map(funds.map((f) => [f.code, f]));

    const fundCodes = positions.map((p) => p.fundCode);
    const allOverrides = await this.rulesService.getAllFundOverrides(fundCodes);

    const signals: StopLossTakeProfitSignal[] = [];

    for (const position of positions) {
      const fund = fundMap.get(position.fundCode);
      if (!fund) continue;

      const lifecycleStage = (fund.lifecycleStage as LifecycleStage) ?? 'dca';
      const costPrice = parseFloat(position.costPrice);
      const currentPrice = parseFloat(position.navUnit ?? '0');
      const valuationPercentile = fund.valuationPercentile
        ? parseFloat(fund.valuationPercentile)
        : null;

      if (costPrice <= 0 || currentPrice <= 0) continue;

      const pnlRate = (currentPrice - costPrice) / costPrice;
      const assetType = fund.assetType ?? 'equity';

      // 获取基金覆盖规则（批量加载）
      const overrides = allOverrides.get(position.fundCode) ?? [];
      const overrideMap = new Map(overrides.map((o) => [o.overrideType, o]));

      // 阶段感知：dca 阶段只输出预警不输出操作
      const showAction = lifecycleStage === 'holding';

      // 1. 四态预警信号
      const alert = computeAlertSignal(pnlRate, rules, valuationPercentile);
      const alertSignal: StopLossTakeProfitSignal = {
        fundCode: position.fundCode,
        fundName: position.fundName,
        costPrice: position.costPrice,
        currentPrice: position.navUnit ?? '0',
        pnlRate: pnlRate.toFixed(4),
        signalType: alert.signalType,
        level: alert.level,
        triggered: alert.level !== 'green',
        threshold: '',
        message: alert.message,
        lifecycleStage,
        showAction: lifecycleStage === 'holding' && alert.level !== 'green',
        valuationPercentile,
      };
      signals.push(alertSignal);

      // 非绿色预警写入信号日志
      if (alert.level !== 'green') {
        await this.writeSignalLog(alertSignal, rules);
      }

      // 2. 止盈信号（仅 holding 阶段触发操作）
      if (showAction) {
        for (let i = rules.takeProfitTiers.length - 1; i >= 0; i--) {
          const tier = rules.takeProfitTiers[i];
          if (pnlRate >= tier.threshold) {
            const nextTierGap = computeNextTierGap(pnlRate, rules.takeProfitTiers, i, 'take_profit');
            const tpSignal: StopLossTakeProfitSignal = {
              fundCode: position.fundCode,
              fundName: position.fundName,
              costPrice: position.costPrice,
              currentPrice: position.navUnit ?? '0',
              pnlRate: pnlRate.toFixed(4),
              signalType: 'take_profit',
              level: tier.level,
              triggered: true,
              threshold: (tier.threshold * 100).toFixed(0) + '%',
              message: `收益达到${(tier.threshold * 100).toFixed(0)}%，建议止盈`,
              lifecycleStage,
              showAction: true,
              nextTierGap,
              valuationPercentile,
            };
            signals.push(tpSignal);
            await this.writeSignalLog(tpSignal, rules);
            break;
          }
        }
      }

      // 3. 止损信号（仅 holding 阶段触发操作，考虑例外规则）
      const noStopLoss = overrideMap.get('no_stop_loss');
      const relaxedStopLoss = overrideMap.get('relaxed_stop_loss');

      if (showAction && !(noStopLoss?.enabled && isLowValuationIndex(assetType, valuationPercentile))) {
        const adjustedThreshold = relaxedStopLoss?.enabled
          ? relaxedStopLoss.value ?? -0.15
          : undefined;

        for (let i = rules.stopLossTiers.length - 1; i >= 0; i--) {
          const tier = rules.stopLossTiers[i];
          const threshold = adjustedThreshold ?? tier.threshold;

          if (pnlRate <= threshold) {
            const nextTierGap = computeNextTierGap(pnlRate, rules.stopLossTiers, i, 'stop_loss');
            const slSignal: StopLossTakeProfitSignal = {
              fundCode: position.fundCode,
              fundName: position.fundName,
              costPrice: position.costPrice,
              currentPrice: position.navUnit ?? '0',
              pnlRate: pnlRate.toFixed(4),
              signalType: 'stop_loss',
              level: tier.level,
              triggered: true,
              threshold: (Math.abs(tier.threshold) * 100).toFixed(0) + '%',
              message: `亏损达到${(Math.abs(tier.threshold) * 100).toFixed(0)}%，建议止损`,
              lifecycleStage,
              showAction: true,
              nextTierGap,
              valuationPercentile,
            };
            signals.push(slSignal);
            await this.writeSignalLog(slSignal, rules);
            break;
          }
        }
      }

      // 4. 深度套牢决策（亏损>20%）
      if (pnlRate <= rules.deepLossThreshold) {
        const context: DeepLossContext = {
          fundCode: position.fundCode,
          fundName: position.fundName,
          costPrice,
          currentPrice,
          pnlRate,
          valuationPercentile,
          lifecycleStage,
          recentWatchDays: await this.getRecentWatchDays(position.fundCode),
          recentPnlTrend: await this.getRecentPnlTrend(position.fundCode, 5),
        };

        const decision = await this.computeDeepLossDecision(context, rules, overrideMap);
        signals.push(decision);

        // 写入信号日志
        await this.writeSignalLog(decision, rules);
      }

      // 5. 反弹信号（仅亏损基金）
      if (pnlRate < 0) {
        const reboundSignals = await this.checkReboundSignals(
          position.fundCode,
          rules.reboundDaily,
          rules.reboundWeekly,
          lifecycleStage,
        );
        signals.push(...reboundSignals);
      }
    }

    return signals;
  }

  async getSignalsByFund(fundCode: string): Promise<StopLossTakeProfitSignal[]> {
    const allSignals = await this.getSignals();
    return allSignals.filter((s) => s.fundCode === fundCode);
  }

  // 计算深度套牢决策
  private async computeDeepLossDecision(
    context: DeepLossContext,
    rules: SlpRules,
    overrides: Map<string, FundRuleOverride>,
  ): Promise<StopLossTakeProfitSignal> {
    const { fundCode, fundName, costPrice, currentPrice, pnlRate, valuationPercentile, lifecycleStage, recentWatchDays, recentPnlTrend } = context;
    const { deepLossDecision } = rules;

    let decision: DeepLossDecision;
    let message: string;
    let stopLossTriggerPrice: string | undefined;

    // 估值分位条件分流：亏损≥20% + 估值>30% → 赎回50%（视为止损）；估值<30% → 加仓
    if (valuationPercentile !== null) {
      if (valuationPercentile > 30) {
        decision = 'C'; // 止损
        message = `深度套牢（亏损${(Math.abs(pnlRate) * 100).toFixed(1)}%），估值偏高（${valuationPercentile.toFixed(0)}%），建议止损赎回50%`;
      } else {
        decision = 'A'; // 补仓
        message = `深度套牢（亏损${(Math.abs(pnlRate) * 100).toFixed(1)}%），估值偏低（${valuationPercentile.toFixed(0)}%），建议补仓`;
      }
    } else {
      // 无估值数据时，根据观望天数和趋势判断
      if (recentWatchDays >= deepLossDecision.watchDays) {
        // 观望升级规则
        const isStillFalling = recentPnlTrend.length >= 2 && recentPnlTrend[0] < recentPnlTrend[recentPnlTrend.length - 1];
        if (isStillFalling) {
          decision = 'C'; // 升级止损
          stopLossTriggerPrice = (currentPrice * (1 + deepLossDecision.stopLossUpgrade)).toFixed(4);
          message = `观望${recentWatchDays}日后继续下跌，升级止损，止损触发价${stopLossTriggerPrice}`;
        } else {
          decision = 'B'; // 维持观望
          stopLossTriggerPrice = (currentPrice * (1 + deepLossDecision.stopLossUpgrade)).toFixed(4);
          message = `观望${recentWatchDays}日，趋势企稳，维持观望，止损触发价${stopLossTriggerPrice}`;
        }
      } else {
        // 根据近期趋势决定补仓还是观望
        const avgTrend = recentPnlTrend.length > 0
          ? recentPnlTrend.reduce((a, b) => a + b, 0) / recentPnlTrend.length
          : 0;

        if (avgTrend > 0.01) {
          decision = 'A'; // 补仓
          message = `深度套牢（亏损${(Math.abs(pnlRate) * 100).toFixed(1)}%），近期有反弹迹象，建议补仓`;
        } else {
          decision = 'B'; // 观望
          message = `深度套牢（亏损${(Math.abs(pnlRate) * 100).toFixed(1)}%），建议观望等待企稳`;
        }
      }
    }

    return {
      fundCode,
      fundName,
      costPrice: costPrice.toFixed(4),
      currentPrice: currentPrice.toFixed(4),
      pnlRate: pnlRate.toFixed(4),
      signalType: 'deep_loss',
      level: 'red',
      triggered: true,
      threshold: (Math.abs(rules.deepLossThreshold) * 100).toFixed(0) + '%',
      message,
      lifecycleStage,
      showAction: lifecycleStage === 'holding',
      deepLossDecision: decision,
      valuationPercentile,
      nextTierGap: undefined,
    };
  }

  // 获取最近观望天数
  private async getRecentWatchDays(fundCode: string): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await this.db
      .select()
      .from(schema.slpSignalsLog)
      .where(
        and(
          eq(schema.slpSignalsLog.fundCode, fundCode),
          eq(schema.slpSignalsLog.deepLossDecision, 'B'),
          gte(schema.slpSignalsLog.triggeredAt, sevenDaysAgo),
        ),
      )
      .orderBy(desc(schema.slpSignalsLog.triggeredAt));

    return logs.length;
  }

  // 获取近期盈亏趋势
  private async getRecentPnlTrend(fundCode: string, days: number): Promise<number[]> {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const navHistory = await this.db
      .select()
      .from(schema.fundNavHistory)
      .where(
        and(
          eq(schema.fundNavHistory.fundCode, fundCode),
          gte(schema.fundNavHistory.navDate, daysAgo.toISOString().split('T')[0]),
        ),
      )
      .orderBy(desc(schema.fundNavHistory.navDate));

    const trend: number[] = [];
    for (let i = 0; i < navHistory.length - 1; i++) {
      const current = parseFloat(navHistory[i].navUnit);
      const previous = parseFloat(navHistory[i + 1].navUnit);
      if (previous > 0) {
        trend.push((current - previous) / previous);
      }
    }
    return trend;
  }

  // 写入信号日志（去重）
  private async writeSignalLog(signal: StopLossTakeProfitSignal, rules: SlpRules): Promise<void> {
    // 检查今天是否已有相同信号
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.db
      .select()
      .from(schema.slpSignalsLog)
      .where(
        and(
          eq(schema.slpSignalsLog.fundCode, signal.fundCode),
          eq(schema.slpSignalsLog.signalType, signal.signalType),
          gte(schema.slpSignalsLog.triggeredAt, today),
        ),
      );

    if (existing.length > 0) return; // 今日已有信号，跳过

    await this.db.insert(schema.slpSignalsLog).values({
      fundCode: signal.fundCode,
      signalType: signal.signalType,
      level: signal.level,
      pnlRate: signal.pnlRate,
      message: signal.message,
      deepLossDecision: signal.deepLossDecision ?? null,
      watchDays: signal.deepLossDecision === 'B' ? await this.getRecentWatchDays(signal.fundCode) : null,
      stopLossTriggerPrice: signal.deepLossDecision === 'C'
        ? (parseFloat(signal.currentPrice) * (1 + rules.deepLossDecision.stopLossUpgrade)).toFixed(4)
        : null,
    });
  }

  // 检查反弹信号（使用 daily_return 字段 + 实时数据）
  private async checkReboundSignals(
    fundCode: string,
    daily: { days: number; threshold: number },
    weekly: { days: number; threshold: number },
    lifecycleStage: LifecycleStage,
  ): Promise<StopLossTakeProfitSignal[]> {
    const signals: StopLossTakeProfitSignal[] = [];

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - weekly.days);

    const navHistory = await this.db
      .select()
      .from(schema.fundNavHistory)
      .where(
        and(
          eq(schema.fundNavHistory.fundCode, fundCode),
          gte(schema.fundNavHistory.navDate, daysAgo.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(schema.fundNavHistory.navDate));

    if (navHistory.length < daily.days) return signals;

    // 获取实时数据（盘中估值）
    let realtimeReturn = 0;
    try {
      const quote = await this.realtimeQuoteService.fetchQuote(fundCode);
      realtimeReturn = parseFloat(quote.dailyReturn) / 100;
    } catch {
      // 实时数据获取失败，忽略
    }

    // 使用 daily_return 字段判断连续涨幅
    const dailyReturns: number[] = [];

    // 添加实时数据（盘中估算）
    if (realtimeReturn > 0) {
      dailyReturns.push(realtimeReturn);
    }

    // 添加历史 daily_return
    for (const nav of navHistory) {
      if (nav.dailyReturn) {
        dailyReturns.push(parseFloat(nav.dailyReturn));
      } else if (dailyReturns.length > 0) {
        // 如果没有 daily_return 字段，使用 navUnit 计算
        const idx = navHistory.indexOf(nav);
        if (idx < navHistory.length - 1) {
          const current = parseFloat(nav.navUnit);
          const previous = parseFloat(navHistory[idx + 1].navUnit);
          if (previous > 0) {
            dailyReturns.push((current - previous) / previous);
          }
        }
      }
    }

    // 连续 N 日涨幅 > 阈值
    let consecutiveDays = 0;
    for (const ret of dailyReturns) {
      if (ret > daily.threshold) {
        consecutiveDays++;
        if (consecutiveDays >= daily.days) break;
      } else {
        consecutiveDays = 0;
      }
    }

    if (consecutiveDays >= daily.days) {
      signals.push({
        fundCode,
        fundName: '',
        costPrice: '',
        currentPrice: navHistory[0]?.navUnit ?? '',
        pnlRate: '',
        signalType: 'take_profit',
        level: 'green',
        triggered: true,
        threshold: `${daily.days}日`,
        message: `连续${daily.days}日涨幅超过${(daily.threshold * 100).toFixed(0)}%，出现反弹信号`,
        lifecycleStage,
        showAction: lifecycleStage === 'holding',
      });
      return signals;
    }

    // 周累计涨幅（使用 daily_return 累加）
    const weeklyReturns = dailyReturns.slice(0, weekly.days);
    const weeklyCumReturn = weeklyReturns.reduce((sum, r) => sum + r, 0);

    if (weeklyCumReturn > weekly.threshold) {
      signals.push({
        fundCode,
        fundName: '',
        costPrice: '',
        currentPrice: navHistory[0]?.navUnit ?? '',
        pnlRate: weeklyCumReturn.toFixed(4),
        signalType: 'take_profit',
        level: 'green',
        triggered: true,
        threshold: `${weekly.days}日`,
        message: `周累计涨幅超过${(weekly.threshold * 100).toFixed(0)}%，出现反弹信号`,
        lifecycleStage,
        showAction: lifecycleStage === 'holding',
      });
    }

    return signals;
  }

  // 获取信号历史
  async getSignalHistory(fundCode?: string, days?: number) {
    const conditions = [];
    if (fundCode) conditions.push(eq(schema.slpSignalsLog.fundCode, fundCode));
    if (days) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      conditions.push(gte(schema.slpSignalsLog.triggeredAt, daysAgo));
    }

    const query = conditions.length > 0
      ? this.db.select().from(schema.slpSignalsLog).where(and(...conditions))
      : this.db.select().from(schema.slpSignalsLog);

    return query.orderBy(desc(schema.slpSignalsLog.triggeredAt));
  }

  // 标记信号已解决
  async resolveSignal(signalId: number): Promise<void> {
    await this.db
      .update(schema.slpSignalsLog)
      .set({ resolved: true })
      .where(eq(schema.slpSignalsLog.id, signalId));
  }
}
