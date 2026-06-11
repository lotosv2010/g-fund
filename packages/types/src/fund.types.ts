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

// 止盈止损信号（四态）
export const SIGNAL_LEVELS = ['green', 'blue', 'yellow', 'red'] as const;
export type SignalLevel = (typeof SIGNAL_LEVELS)[number];

export const SIGNAL_LEVEL_LABELS: Record<SignalLevel, string> = {
  green: '正常',
  blue: '低估',
  yellow: '接近止损',
  red: '接近止盈',
};

// 深度套牢决策
export const DEEP_LOSS_DECISIONS = ['A', 'B', 'C'] as const;
export type DeepLossDecision = (typeof DEEP_LOSS_DECISIONS)[number];

export const DEEP_LOSS_DECISION_LABELS: Record<DeepLossDecision, string> = {
  A: '补仓',
  B: '观望',
  C: '止损',
};

export interface StopLossTakeProfitSignal {
  fundCode: string;
  fundName: string;
  costPrice: string;
  currentPrice: string;
  pnlRate: string;
  signalType: 'take_profit' | 'stop_loss' | 'warning' | 'deep_loss';
  level: SignalLevel;
  triggered: boolean;
  threshold: string;
  message: string;
  lifecycleStage: LifecycleStage;
  showAction: boolean; // holding 阶段才显示操作按钮
  deepLossDecision?: DeepLossDecision;
  nextTierGap?: number; // 距离下一档差距百分比
  valuationPercentile?: number | null;
}

// 定投计算结果
export interface DcaCalculation {
  fundCode: string;
  fundName: string;
  baseAmount: string;
  valuationPercentile: string | null;
  phase: FundPhase | null;
  priority: number;
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  tFactor: number;
  finalAmount: string;
  skipped: boolean;
  skipReason?: string;
  isBiweeklyThursday: boolean;
  nextDcaDate: string;
  rebalanceAdjustment?: number;
  bulletReserveAmount?: number;
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

// --- 规则配置类型 (M11) ---

export interface ValuationPercentileRule {
  max: number;
  multiplier: number;
}

export interface PriorityMultiplierRule {
  minPriority: number;
  multiplier: number;
}

export interface DcaRules {
  valuationPercentiles: ValuationPercentileRule[];
  valuationLevelMultipliers: Record<ValuationLevel, number>;
  priorityMultipliers: PriorityMultiplierRule[];
  maxMultiplier: number;
  minThreshold: number;
  p1Thresholds: { up: number; down: number };
  tFactorThresholds: { bullMarket: number; bearMarket: number };
  biweeklyAnchorDate: string;
}

export interface SlpTierRule {
  level: SignalLevel;
  threshold: number;
}

export interface ReboundRule {
  days: number;
  threshold: number;
}

export interface SlpRules {
  takeProfitTiers: SlpTierRule[];
  stopLossTiers: SlpTierRule[];
  deepLossThreshold: number;
  warningThreshold: number;
  reboundDaily: ReboundRule;
  reboundWeekly: ReboundRule;
  // 四态预警阈值
  alertThresholds: {
    takeProfit: number; // 接近止盈阈值 (默认 0.20)
    stopLoss: number; // 接近止损阈值 (默认 -0.08)
    undervalue: number; // 低估阈值 (默认 0.30)
  };
  // 深度套牢决策阈值
  deepLossDecision: {
    watchDays: number; // 观望天数阈值 (默认 5)
    stopLossUpgrade: number; // 观望升级止损阈值 (默认 -0.05)
  };
}

export const FUND_RULE_OVERRIDE_TYPES = [
  'no_stop_loss',
  'relaxed_stop_loss',
  'pause_speed',
  'fixed_amount',
] as const;
export type FundRuleOverrideType = (typeof FUND_RULE_OVERRIDE_TYPES)[number];

export const FUND_RULE_OVERRIDE_LABELS: Record<FundRuleOverrideType, string> = {
  no_stop_loss: '不止损',
  relaxed_stop_loss: '止损放宽',
  pause_speed: '暂停调速',
  fixed_amount: '固定金额',
};

export interface FundRuleOverride {
  fundCode: string;
  overrideType: FundRuleOverrideType;
  enabled: boolean;
  value: number | null;
  updatedAt: string;
}

export interface SlpSignalLog {
  id: number;
  fundCode: string;
  signalType: string;
  level: SignalLevel;
  triggeredAt: string;
  pnlRate: string | null;
  message: string | null;
  resolved: boolean;
  deepLossDecision?: DeepLossDecision;
  watchDays?: number; // 观望天数
  stopLossTriggerPrice?: string; // 止损触发价
}

export interface DcaSnapshot {
  id: number;
  planDate: string;
  fundCode: string;
  baseAmount: string | null;
  p0: string | null;
  p1: string | null;
  p2: string | null;
  p3: string | null;
  p4: string | null;
  tFactor: string | null;
  finalAmount: string | null;
  executed: boolean;
  createdAt: string;
}

export interface BulletReserve {
  amount: number;
  lastTriggeredDate: string | null;
}

export const DEFAULT_DCA_RULES: DcaRules = {
  valuationPercentiles: [
    { max: 20, multiplier: 2.0 },
    { max: 40, multiplier: 1.5 },
    { max: 60, multiplier: 1.0 },
    { max: 80, multiplier: 0.5 },
    { max: 100, multiplier: 0.2 },
  ],
  valuationLevelMultipliers: { low: 1.5, normal: 1.0, high: 0.5 },
  priorityMultipliers: [
    { minPriority: 3, multiplier: 1.5 },
    { minPriority: 2, multiplier: 1.2 },
    { minPriority: 1, multiplier: 1.0 },
    { minPriority: 0, multiplier: 0.8 },
  ],
  maxMultiplier: 3.0,
  minThreshold: 0.10,
  p1Thresholds: { up: 2, down: -2 },
  tFactorThresholds: { bullMarket: 5, bearMarket: 5 },
  biweeklyAnchorDate: '2026-05-28',
};

export const DEFAULT_SLP_RULES: SlpRules = {
  takeProfitTiers: [
    { level: 'green', threshold: 0.25 },
    { level: 'yellow', threshold: 0.40 },
    { level: 'red', threshold: 0.60 },
  ],
  stopLossTiers: [
    { level: 'yellow', threshold: -0.10 },
    { level: 'red', threshold: -0.20 },
  ],
  deepLossThreshold: -0.20,
  warningThreshold: -0.08,
  reboundDaily: { days: 3, threshold: 0.01 },
  reboundWeekly: { days: 7, threshold: 0.03 },
  alertThresholds: {
    takeProfit: 0.20, // 接近止盈阈值 20%
    stopLoss: -0.08, // 接近止损阈值 -8%
    undervalue: 0.30, // 低估阈值 30%
  },
  deepLossDecision: {
    watchDays: 5, // 连续观望天数阈值
    stopLossUpgrade: -0.05, // 观望升级止损阈值
  },
};
