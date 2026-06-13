export interface DailySnapshot {
  id: number;
  snapshotDate: string;
  totalCost: string;
  totalValue: string;
  totalPnl: string;
  pnlRatio: string;
  positionCount: number;
  positionsSnapshot: PositionSnapshotItem[] | null;
  createdAt: string;
}

export interface PositionSnapshotItem {
  fundCode: string;
  fundName: string;
  shares: string;
  costAmount: string;
  currentValue: string;
  pnlAmount: string;
  pnlRate: string;
  netBuyAmount: string; // 当日净买入金额 = 今日costAmount - 昨日costAmount，用于剔除买卖对当日盈亏的扰动
}

export interface FundDailyPnl {
  snapshotDate: string;
  fundCode: string;
  fundName: string;
  pnlAmount: number;
  pnlRate: number;
  costAmount: number;
  currentValue: number;
  dailyPnlAmount: number; // 当日盈亏金额 = currentValue - prevCurrentValue - netBuyAmount
  dailyPnlRate: number;   // 当日盈亏率 = dailyPnlAmount / (prevCurrentValue + netBuyAmount)
}
