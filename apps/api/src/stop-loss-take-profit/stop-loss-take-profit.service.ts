import { Injectable, Inject } from '@nestjs/common';
import { eq, ne, and, gte, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { StopLossTakeProfitSignal, SignalLevel } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

// 止盈止损阈值配置
const TAKE_PROFIT_THRESHOLDS = [
  { level: 'green' as SignalLevel, threshold: 0.25, message: '收益达到25%，建议止盈一档' },
  { level: 'yellow' as SignalLevel, threshold: 0.40, message: '收益达到40%，建议止盈二档' },
  { level: 'red' as SignalLevel, threshold: 0.60, message: '收益达到60%，建议止盈三档' },
];

const STOP_LOSS_THRESHOLDS = [
  { level: 'yellow' as SignalLevel, threshold: -0.10, message: '亏损达到10%，建议止损一档' },
  { level: 'red' as SignalLevel, threshold: -0.20, message: '亏损达到20%，建议止损二档' },
];

// 反弹信号配置
const REBOUND_THRESHOLDS = {
  daily: { days: 3, threshold: 0.01, message: '连续3日涨幅超过1%，出现反弹信号' },
  weekly: { days: 7, threshold: 0.03, message: '周累计涨幅超过3%，出现反弹信号' },
};

@Injectable()
export class StopLossTakeProfitService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async getSignals(): Promise<StopLossTakeProfitSignal[]> {
    // 获取所有持仓
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

      // 检查止盈信号（只保留最严重的一档，从高阈值往低阈值遍历）
      for (let i = TAKE_PROFIT_THRESHOLDS.length - 1; i >= 0; i--) {
        const threshold = TAKE_PROFIT_THRESHOLDS[i];
        if (pnlRate >= threshold.threshold) {
          signals.push({
            fundCode: position.fundCode,
            fundName: position.fundName,
            costPrice: position.costPrice,
            currentPrice: position.navUnit ?? '0',
            pnlRate: pnlRate.toFixed(4),
            signalType: 'take_profit',
            level: threshold.level,
            triggered: true,
            threshold: (threshold.threshold * 100).toFixed(0) + '%',
            message: threshold.message,
          });
          break;
        }
      }

      // 检查止损信号（只保留最严重的一档，从低阈值往高阈值遍历）
      for (let i = STOP_LOSS_THRESHOLDS.length - 1; i >= 0; i--) {
        const threshold = STOP_LOSS_THRESHOLDS[i];
        if (pnlRate <= threshold.threshold) {
          signals.push({
            fundCode: position.fundCode,
            fundName: position.fundName,
            costPrice: position.costPrice,
            currentPrice: position.navUnit ?? '0',
            pnlRate: pnlRate.toFixed(4),
            signalType: 'stop_loss',
            level: threshold.level,
            triggered: true,
            threshold: (Math.abs(threshold.threshold) * 100).toFixed(0) + '%',
            message: threshold.message,
          });
          break;
        }
      }

      // 检查反弹信号（仅对亏损基金）
      if (pnlRate < 0) {
        const reboundSignals = await this.checkReboundSignals(position.fundCode);
        signals.push(...reboundSignals);
      }
    }

    return signals;
  }

  async getSignalsByFund(fundCode: string): Promise<StopLossTakeProfitSignal[]> {
    const allSignals = await this.getSignals();
    return allSignals.filter((s) => s.fundCode === fundCode);
  }

  private async checkReboundSignals(fundCode: string): Promise<StopLossTakeProfitSignal[]> {
    const signals: StopLossTakeProfitSignal[] = [];

    // 获取最近7天的净值数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const navHistory = await this.db
      .select()
      .from(schema.fundNavHistory)
      .where(
        and(
          eq(schema.fundNavHistory.fundCode, fundCode),
          gte(schema.fundNavHistory.navDate, sevenDaysAgo.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(schema.fundNavHistory.navDate));

    if (navHistory.length < 3) return signals;

    // 检查连续3日涨幅
    let consecutiveDays = 0;
    for (let i = 0; i < navHistory.length - 1 && consecutiveDays < 3; i++) {
      const current = parseFloat(navHistory[i].navUnit);
      const previous = parseFloat(navHistory[i + 1].navUnit);
      const dailyReturn = (current - previous) / previous;

      if (dailyReturn > REBOUND_THRESHOLDS.daily.threshold) {
        consecutiveDays++;
      } else {
        consecutiveDays = 0;
      }
    }

    if (consecutiveDays >= 3) {
      signals.push({
        fundCode,
        fundName: '', // Will be filled by caller
        costPrice: '',
        currentPrice: navHistory[0].navUnit,
        pnlRate: '',
        signalType: 'take_profit',
        level: 'green',
        triggered: true,
        threshold: '3日',
        message: REBOUND_THRESHOLDS.daily.message,
      });
      return signals; // 已触发最强反弹信号，跳过周累计检查
    }

    // 检查周累计涨幅
    if (navHistory.length >= 2) {
      const latestPrice = parseFloat(navHistory[0].navUnit);
      const oldestPrice = parseFloat(navHistory[navHistory.length - 1].navUnit);
      const weeklyReturn = (latestPrice - oldestPrice) / oldestPrice;

      if (weeklyReturn > REBOUND_THRESHOLDS.weekly.threshold) {
        signals.push({
          fundCode,
          fundName: '',
          costPrice: '',
          currentPrice: navHistory[0].navUnit,
          pnlRate: weeklyReturn.toFixed(4),
          signalType: 'take_profit',
          level: 'green',
          triggered: true,
          threshold: '7日',
          message: REBOUND_THRESHOLDS.weekly.message,
        });
      }
    }

    return signals;
  }
}
