import type {
  StopLossTakeProfitSignal,
  SignalLevel,
  SlpRules,
} from '@g-fund/types';

// --- 四态预警信号 ---

export function computeAlertSignal(
  pnlRate: number,
  rules: SlpRules,
  valuationPercentile: number | null,
): { level: SignalLevel; signalType: StopLossTakeProfitSignal['signalType']; message: string; threshold: string } {
  const { alertThresholds } = rules;

  if (pnlRate >= alertThresholds.takeProfit) {
    return {
      level: 'red',
      signalType: 'warning',
      message: `接近止盈线（${(alertThresholds.takeProfit * 100).toFixed(0)}%），当前收益${(pnlRate * 100).toFixed(1)}%`,
      threshold: (alertThresholds.takeProfit * 100).toFixed(0) + '%',
    };
  }

  if (pnlRate <= alertThresholds.stopLoss) {
    return {
      level: 'yellow',
      signalType: 'warning',
      message: `接近止损线（${(Math.abs(alertThresholds.stopLoss) * 100).toFixed(0)}%），当前亏损${(Math.abs(pnlRate) * 100).toFixed(1)}%`,
      threshold: (Math.abs(alertThresholds.stopLoss) * 100).toFixed(0) + '%',
    };
  }

  if (
    valuationPercentile !== null &&
    valuationPercentile < alertThresholds.undervalue * 100
  ) {
    return {
      level: 'blue',
      signalType: 'warning',
      message: `低估区间（估值分位${valuationPercentile.toFixed(0)}%<${(alertThresholds.undervalue * 100).toFixed(0)}%）`,
      threshold: (alertThresholds.undervalue * 100).toFixed(0) + '%',
    };
  }

  return {
    level: 'green',
    signalType: 'warning',
    message: '正常区间',
    threshold: '',
  };
}

// --- 距离下一档差距 ---

export function computeNextTierGap(
  pnlRate: number,
  tiers: { threshold: number }[],
  currentIndex: number,
  signalType: 'take_profit' | 'stop_loss',
): number | undefined {
  if (signalType === 'take_profit') {
    if (currentIndex < tiers.length - 1) {
      const nextThreshold = tiers[currentIndex + 1].threshold;
      return (nextThreshold - pnlRate) / pnlRate * 100;
    }
  } else {
    if (currentIndex < tiers.length - 1) {
      const nextThreshold = tiers[currentIndex + 1].threshold;
      return (pnlRate - nextThreshold) / Math.abs(pnlRate) * 100;
    }
  }
  return undefined;
}

// --- 低估指数基金判断 ---

export function isLowValuationIndex(
  assetType: string,
  valuationPercentile: number | null,
): boolean {
  if (assetType !== 'index') return false;
  if (valuationPercentile === null) return false;
  return valuationPercentile < 30;
}
