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
}
