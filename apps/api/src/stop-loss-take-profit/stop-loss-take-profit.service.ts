import { Injectable, Inject } from '@nestjs/common';
import { eq, ne, and, gte, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { RulesService } from '../rules/rules.service';
import { StopLossTakeProfitSignal, SignalLevel } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

@Injectable()
export class StopLossTakeProfitService {
  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly rulesService: RulesService,
  ) {}

  async getSignals(): Promise<StopLossTakeProfitSignal[]> {
    const rules = await this.rulesService.getSlpRules();

    const positions = await this.db
      .select()
      .from(schema.positions)
      .where(ne(schema.positions.shares, '0'));

    const signals: StopLossTakeProfitSignal[] = [];

    for (const position of positions) {
      const costPrice = parseFloat(position.costPrice);
      const currentPrice = parseFloat(position.navUnit ?? '0');

      if (costPrice <= 0 || currentPrice <= 0) continue;

      const pnlRate = (currentPrice - costPrice) / costPrice;

      // 止盈信号（从高阈值往低阈值遍历，只保留最严重的一档）
      for (let i = rules.takeProfitTiers.length - 1; i >= 0; i--) {
        const tier = rules.takeProfitTiers[i];
        if (pnlRate >= tier.threshold) {
          signals.push({
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
          });
          break;
        }
      }

      // 止损信号（从低阈值往高阈值遍历，只保留最严重的一档）
      for (let i = rules.stopLossTiers.length - 1; i >= 0; i--) {
        const tier = rules.stopLossTiers[i];
        if (pnlRate <= tier.threshold) {
          signals.push({
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
          });
          break;
        }
      }

      // 反弹信号（仅对亏损基金）
      if (pnlRate < 0) {
        const reboundSignals = await this.checkReboundSignals(
          position.fundCode,
          rules.reboundDaily,
          rules.reboundWeekly,
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

  private async checkReboundSignals(
    fundCode: string,
    daily: { days: number; threshold: number },
    weekly: { days: number; threshold: number },
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

    // 连续 N 日涨幅
    let consecutiveDays = 0;
    for (let i = 0; i < navHistory.length - 1 && consecutiveDays < daily.days; i++) {
      const current = parseFloat(navHistory[i].navUnit);
      const previous = parseFloat(navHistory[i + 1].navUnit);
      const dailyReturn = (current - previous) / previous;

      if (dailyReturn > daily.threshold) {
        consecutiveDays++;
      } else {
        consecutiveDays = 0;
      }
    }

    if (consecutiveDays >= daily.days) {
      signals.push({
        fundCode,
        fundName: '',
        costPrice: '',
        currentPrice: navHistory[0].navUnit,
        pnlRate: '',
        signalType: 'take_profit',
        level: 'green',
        triggered: true,
        threshold: `${daily.days}日`,
        message: `连续${daily.days}日涨幅超过${(daily.threshold * 100).toFixed(0)}%，出现反弹信号`,
      });
      return signals;
    }

    // 周累计涨幅
    if (navHistory.length >= 2) {
      const latestPrice = parseFloat(navHistory[0].navUnit);
      const oldestPrice = parseFloat(navHistory[navHistory.length - 1].navUnit);
      const weeklyReturn = (latestPrice - oldestPrice) / oldestPrice;

      if (weeklyReturn > weekly.threshold) {
        signals.push({
          fundCode,
          fundName: '',
          costPrice: '',
          currentPrice: navHistory[0].navUnit,
          pnlRate: weeklyReturn.toFixed(4),
          signalType: 'take_profit',
          level: 'green',
          triggered: true,
          threshold: `${weekly.days}日`,
          message: `周累计涨幅超过${(weekly.threshold * 100).toFixed(0)}%，出现反弹信号`,
        });
      }
    }

    return signals;
  }
}
