export interface FundAssetClassNode {
  categoryCode: string;
  categoryName: string;
  levelType: "TOP_LEVEL" | "LEVEL1" | "LEVEL2";
  amount: number;
  ratio: number;
  color: string;
  children: FundAssetClassNode[];
}

export interface FundAssetDetail {
  fundCode: string;
  fundName: string;
  currentValue: string;
  topCategory: string;
  level1Category: string;
  level2Category: string;
  categoryCode: string;
}

export interface AssetAllocationResponse {
  categoryTree: FundAssetClassNode[];
  fundDetails: FundAssetDetail[];
}

export interface RebalanceSuggestion {
  fundCode: string;
  fundName: string;
  currentValue: number;
  targetValue: number;
  currentRatio: number;
  targetRatio: number;
  deviation: number;
  action: 'buy' | 'sell';
  amount: number;
}

export interface RebalanceResponse {
  totalValue: number;
  targetTotalPosition: number;
  suggestions: RebalanceSuggestion[];
}

export interface RiskSummaryResponse {
  /** 最大回撤（0~1，如 0.15 = 15%），基于 daily_snapshots 全历史 */
  maxDrawdown: number;
  /** 年化波动率（0~1），基于交易日日收益率标准差 × √252 */
  annualizedVolatility: number;
  /** 当前回撤（0~1），从历史峰值到当前净值的幅度 */
  currentDrawdown: number;
  /** 计算所用的快照天数 */
  snapshotDays: number;
}

export interface BenchmarkPoint {
  date: string;
  /** 组合累计收益率（0~1，如 0.12 = +12%） */
  portfolioCumReturn: number;
  /** 基准指数累计收益率（0~1） */
  benchmarkCumReturn: number;
}

export interface BenchmarkComparisonResponse {
  points: BenchmarkPoint[];
  benchmarkName: string;
  snapshotCount: number;
}

export type AnomalyType =
  | 'price_surge'
  | 'price_drop'
  | 'valuation_high'
  | 'valuation_low'
  | 'stop_loss'
  | 'take_profit';

export type AnomalySeverity = 'info' | 'warning' | 'danger';

export interface AnomalyAlert {
  fundCode: string;
  fundName: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  value?: number;
}

export interface AnomalyResponse {
  alerts: AnomalyAlert[];
  checkedAt: string;
}

export interface IndustryExposureItem {
  industry: string;
  amount: number;
  ratio: number;
}

export interface IndustryExposureResponse {
  items: IndustryExposureItem[];
  totalAmount: number;
}
