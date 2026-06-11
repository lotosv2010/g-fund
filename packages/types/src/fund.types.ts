export const FUND_CATEGORIES = ['all', 'longterm', 'watchlist'] as const;
export type FundCategory = (typeof FUND_CATEGORIES)[number];

export const FUND_CATEGORY_LABELS: Record<FundCategory, string> = {
  all: '所有',
  longterm: '长期',
  watchlist: '关注',
};

export const FUND_PHASES = ['low', 'normal', 'high'] as const;
export type FundPhase = (typeof FUND_PHASES)[number];

export const FUND_PHASE_LABELS: Record<FundPhase, string> = {
  low: '低估',
  normal: '正常',
  high: '高估',
};

// 估值水平（替代旧 phase 的估值含义）
export const VALUATION_LEVELS = ['low', 'normal', 'high'] as const;
export type ValuationLevel = (typeof VALUATION_LEVELS)[number];

export const VALUATION_LEVEL_LABELS: Record<ValuationLevel, string> = {
  low: '低估',
  normal: '正常',
  high: '高估',
};

// 生命周期阶段：持仓金额 / 目标金额 ≥ 80% → holding
export const LIFECYCLE_STAGES = ['dca', 'holding'] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  dca: '定投期',
  holding: '持有期',
};

// 资产类型：用于例外规则匹配（纯债不调速 / 黄金止损放宽 / 低估指数不止损）
export const ASSET_TYPES = ['equity', 'bond', 'gold', 'qdii', 'index'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  equity: '权益',
  bond: '债券',
  gold: '黄金',
  qdii: 'QDII',
  index: '指数',
};

// 止盈止损信号
export const SIGNAL_LEVELS = ['green', 'yellow', 'red'] as const;
export type SignalLevel = (typeof SIGNAL_LEVELS)[number];

export const SIGNAL_LEVEL_LABELS: Record<SignalLevel, string> = {
  green: '安全',
  yellow: '警告',
  red: '危险',
};

export interface StopLossTakeProfitSignal {
  fundCode: string;
  fundName: string;
  costPrice: string;
  currentPrice: string;
  pnlRate: string;
  signalType: 'take_profit' | 'stop_loss';
  level: SignalLevel;
  triggered: boolean;
  threshold: string;
  message: string;
}

// 定投计算结果
export interface DcaCalculation {
  fundCode: string;
  fundName: string;
  baseAmount: string;
  valuationPercentile: string | null;
  phase: FundPhase | null;
  priority: number;
  p2: number;
  p3: number;
  p4: number;
  finalAmount: string;
  skipped: boolean;
  skipReason?: string;
}

export interface Fund {
  id: number;
  code: string;
  name: string;
  type: string | null;
  riskLevel: number | null;
  category: FundCategory;
  sortOrder: number;
  targetAmount: string;
  targetRatio: string;
  valuationPercentile: string | null;
  phase: FundPhase | null;
  valuationLevel: ValuationLevel | null;
  lifecycleStage: LifecycleStage;
  assetType: AssetType;
  stageChangedAt: string | null;
  priority: number;
  baseAmount: string;
  weeklyReturn: string | null;
  monthlyReturn: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundListItem extends Fund {
  costAmount: string;
  currentValue: string;
  pnlAmount: string;
  pnlRate: string;
  hasPosition: boolean;
}

export interface CreateFundDto {
  code: string;
  name: string;
  type?: string;
  riskLevel?: number;
  category?: FundCategory;
  targetAmount?: string;
  targetRatio?: string;
  valuationPercentile?: string;
  phase?: FundPhase;
  valuationLevel?: ValuationLevel;
  lifecycleStage?: LifecycleStage;
  assetType?: AssetType;
  priority?: number;
  baseAmount?: string;
  note?: string;
}

export interface UpdateFundDto {
  name?: string;
  type?: string;
  riskLevel?: number;
  category?: FundCategory;
  sortOrder?: number;
  targetAmount?: string;
  targetRatio?: string;
  valuationPercentile?: string | null;
  phase?: FundPhase | null;
  valuationLevel?: ValuationLevel | null;
  lifecycleStage?: LifecycleStage;
  assetType?: AssetType;
  priority?: number;
  baseAmount?: string;
  weeklyReturn?: string | null;
  monthlyReturn?: string | null;
  note?: string;
}

export interface ReorderFundDto {
  code: string;
  sortOrder: number;
}

// 盘中实时估值（天天基金 API）
export interface RealtimeQuote {
  fundCode: string;
  name: string;
  estimateNav: string;    // 盘中估算净值
  dailyReturn: string;    // 估算涨跌幅 %
  lastNav: string;        // 上一交易日净值
  lastNavDate: string;    // 净值日期
  estimateTime: string;   // 估值时间
  isEstimate: boolean;    // 盘中=true, 收盘后=false
}

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
}
