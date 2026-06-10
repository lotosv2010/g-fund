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

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
}
