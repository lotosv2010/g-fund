import type {
  DcaRules,
  FundRuleOverride,
  FundRuleOverrideType,
  LifecycleStage,
} from '@g-fund/types';

// --- P2: 估值百分位系数 ---

export function calcP2(
  percentile: number,
  rules: Array<{ max: number; multiplier: number }>,
): number {
  for (const rule of rules) {
    if (percentile <= rule.max) return rule.multiplier;
  }
  return rules[rules.length - 1]?.multiplier ?? 1.0;
}

// --- P3: 月涨幅调整系数 ---

export function calcP3MonthlyAdjustment(monthlyReturn: number | null): number {
  if (monthlyReturn === null) return 1.0;
  if (monthlyReturn > 0.20) return 0;
  if (monthlyReturn > 0.10) return 0.5;
  if (monthlyReturn < -0.10) return 1.5;
  if (monthlyReturn < -0.05) return 1.3;
  return 1.0;
}

// --- P4: 优先级系数 ---

export function calcP4(
  priority: number,
  rules: Array<{ minPriority: number; multiplier: number }>,
): number {
  for (const rule of rules) {
    if (priority >= rule.minPriority) return rule.multiplier;
  }
  return rules[rules.length - 1]?.multiplier ?? 1.0;
}

// --- 日期工具：统一使用本地日期 ---

export function toLocalMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// --- 双周四判断 ---

export function checkBiweeklyThursday(anchorDate: string, today?: Date): boolean {
  const now = today ?? new Date();
  const anchor = toLocalMidnight(anchorDate);
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight.getTime() - anchor.getTime()) / 86_400_000);
  const dayOfWeek = nowMidnight.getDay();
  return dayOfWeek === 4 && diffDays % 14 === 0 && diffDays >= 0;
}

// --- 下一个定投日 ---

export function computeNextDcaDate(anchorDate: string, today?: Date): string {
  const now = today ?? new Date();
  const anchor = toLocalMidnight(anchorDate);
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((nowMidnight.getTime() - anchor.getTime()) / 86_400_000);

  if (diffDays < 0) return anchorDate;

  const cyclesElapsed = Math.floor(diffDays / 14);
  const next = new Date(anchor);
  next.setDate(next.getDate() + (cyclesElapsed + 1) * 14);

  if (nowMidnight.getDay() === 4 && diffDays % 14 === 0) {
    return toLocalDateStr(nowMidnight);
  }

  return toLocalDateStr(next);
}

// --- T 因子优先级调整 ---

export function calcTFactorPriority(
  valuationPercentile: number | null,
  lifecycleStage: LifecycleStage,
  costAmount: number,
  targetAmount: number,
  monthlyReturn: number | null,
  rules: DcaRules,
): number {
  const progress = targetAmount > 0 ? costAmount / targetAmount : 0;

  if (progress > 1.0) return 0;
  if (monthlyReturn !== null && monthlyReturn > 0.20) return 0.5;
  if (valuationPercentile !== null && valuationPercentile < 20 && progress < 0.5) return 1.2;

  return 1.0;
}

// --- 月初判断 ---

export function isFirstDcaOfMonth(dateStr: string): boolean {
  const date = toLocalMidnight(dateStr);
  return date.getDate() <= 7;
}

// --- 例外规则检查 ---

export function isOverrideEnabled(
  overrides: FundRuleOverride[],
  type: FundRuleOverrideType,
): boolean {
  return overrides.some((o) => o.overrideType === type && o.enabled);
}
