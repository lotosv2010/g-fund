import { describe, it, expect } from 'vitest';
import {
  calcP2,
  calcP3MonthlyAdjustment,
  calcP4,
  checkBiweeklyThursday,
  computeNextDcaDate,
  calcTFactorPriority,
  isFirstDcaOfMonth,
  isOverrideEnabled,
} from '../src/dca/dca-calc';
import { DEFAULT_DCA_RULES } from '@g-fund/types';
import type { FundRuleOverride, DcaRules } from '@g-fund/types';

// ── P2: 估值百分位系数 ──

describe('calcP2', () => {
  const rules = DEFAULT_DCA_RULES.valuationPercentiles;

  it('百分位 0 → 最高倍率', () => {
    expect(calcP2(0, rules)).toBe(rules[0].multiplier);
  });

  it('百分位恰好等于档位上限', () => {
    expect(calcP2(rules[0].max, rules)).toBe(rules[0].multiplier);
  });

  it('百分位刚好超过第一档', () => {
    expect(calcP2(rules[0].max + 0.1, rules)).toBe(rules[1].multiplier);
  });

  it('百分位 100 → 最低倍率', () => {
    expect(calcP2(100, rules)).toBe(rules[rules.length - 1].multiplier);
  });

  it('空规则数组 → 默认 1.0', () => {
    expect(calcP2(50, [])).toBe(1.0);
  });
});

// ── P3: 月涨幅调整系数 ──

describe('calcP3MonthlyAdjustment', () => {
  it('null → 1.0', () => {
    expect(calcP3MonthlyAdjustment(null)).toBe(1.0);
  });

  it('> 20% → 0（跳过）', () => {
    expect(calcP3MonthlyAdjustment(0.21)).toBe(0);
  });

  it('恰好 20% → 0.5（>10% 分支）', () => {
    expect(calcP3MonthlyAdjustment(0.20)).toBe(0.5);
  });

  it('> 10% → 0.5（减半）', () => {
    expect(calcP3MonthlyAdjustment(0.15)).toBe(0.5);
  });

  it('< -10% → 1.5（加仓）', () => {
    expect(calcP3MonthlyAdjustment(-0.11)).toBe(1.5);
  });

  it('恰好 -10% → 1.3（<-5% 分支）', () => {
    expect(calcP3MonthlyAdjustment(-0.10)).toBe(1.3);
  });

  it('< -5% → 1.3', () => {
    expect(calcP3MonthlyAdjustment(-0.06)).toBe(1.3);
  });

  it('恰好 -5% → 1.0（边界）', () => {
    expect(calcP3MonthlyAdjustment(-0.05)).toBe(1.0);
  });

  it('0% → 1.0', () => {
    expect(calcP3MonthlyAdjustment(0)).toBe(1.0);
  });
});

// ── P4: 优先级系数 ──

describe('calcP4', () => {
  const rules = DEFAULT_DCA_RULES.priorityMultipliers;

  it('优先级 0 → 最低倍率', () => {
    expect(calcP4(0, rules)).toBe(rules[rules.length - 1].multiplier);
  });

  it('优先级达到最高档', () => {
    expect(calcP4(rules[0].minPriority, rules)).toBe(rules[0].multiplier);
  });

  it('空规则数组 → 默认 1.0', () => {
    expect(calcP4(5, [])).toBe(1.0);
  });
});

// ── 双周四判断 ──

describe('checkBiweeklyThursday', () => {
  it('非周四 → false', () => {
    const anchor = '2026-01-01'; // 周四
    const wed = new Date('2026-01-07'); // 周三
    expect(checkBiweeklyThursday(anchor, wed)).toBe(false);
  });

  it('周四但非双周 → false', () => {
    const anchor = '2026-01-01'; // 周四
    const nextThu = new Date('2026-01-08'); // 下一个周四（7天后，非14天）
    expect(checkBiweeklyThursday(anchor, nextThu)).toBe(false);
  });

  it('双周四 → true', () => {
    const anchor = '2026-01-01'; // 周四
    const biweeklyThu = new Date('2026-01-15'); // 14天后，周四
    expect(checkBiweeklyThursday(anchor, biweeklyThu)).toBe(true);
  });

  it('anchor 之前 → false', () => {
    const anchor = '2026-01-15';
    const before = new Date('2026-01-01');
    expect(checkBiweeklyThursday(anchor, before)).toBe(false);
  });
});

// ── 下一个定投日 ──

describe('computeNextDcaDate', () => {
  it('今天是双周四 → 返回今天', () => {
    const anchor = '2026-01-01';
    const today = new Date('2026-01-15'); // 双周四
    expect(computeNextDcaDate(anchor, today)).toBe('2026-01-15');
  });

  it('今天是周三 → 返回明天（周四）', () => {
    const anchor = '2026-01-01';
    const today = new Date('2026-01-14'); // 周三
    const result = computeNextDcaDate(anchor, today);
    // 下一个双周四应该是 2026-01-15
    expect(result).toBe('2026-01-15');
  });

  it('今天在 anchor 之前 → 返回 anchor', () => {
    const anchor = '2026-02-01';
    const today = new Date('2026-01-15');
    expect(computeNextDcaDate(anchor, today)).toBe('2026-02-01');
  });
});

// ── T 因子优先级调整 ──

describe('calcTFactorPriority', () => {
  const rules = DEFAULT_DCA_RULES as DcaRules;

  it('超配（progress > 1.0）→ 0', () => {
    expect(calcTFactorPriority(null, 'dca', 110, 100, null, rules)).toBe(0);
  });

  it('接近止盈（monthlyReturn > 20%）→ 0.5', () => {
    expect(calcTFactorPriority(null, 'holding', 50, 100, 0.25, rules)).toBe(0.5);
  });

  it('低估 + 大缺口 → 1.2', () => {
    expect(calcTFactorPriority(15, 'dca', 30, 100, null, rules)).toBe(1.2);
  });

  it('正常情况 → 1.0', () => {
    expect(calcTFactorPriority(50, 'holding', 50, 100, 0.05, rules)).toBe(1.0);
  });

  it('估值 20%（边界）→ 不触发低估加仓', () => {
    expect(calcTFactorPriority(20, 'dca', 30, 100, null, rules)).toBe(1.0);
  });

  it('progress 50%（边界）→ 不触发低估加仓', () => {
    expect(calcTFactorPriority(15, 'dca', 50, 100, null, rules)).toBe(1.0);
  });
});

// ── 月初判断 ──

describe('isFirstDcaOfMonth', () => {
  it('1 号 → true', () => {
    expect(isFirstDcaOfMonth('2026-01-01')).toBe(true);
  });

  it('7 号 → true', () => {
    expect(isFirstDcaOfMonth('2026-01-07')).toBe(true);
  });

  it('8 号 → false', () => {
    expect(isFirstDcaOfMonth('2026-01-08')).toBe(false);
  });

  it('15 号 → false', () => {
    expect(isFirstDcaOfMonth('2026-01-15')).toBe(false);
  });
});

// ── 例外规则检查 ──

describe('isOverrideEnabled', () => {
  const overrides: FundRuleOverride[] = [
    { fundCode: '001', overrideType: 'pause_speed', enabled: true, value: null, updatedAt: '2026-01-01' },
    { fundCode: '001', overrideType: 'fixed_amount', enabled: false, value: 1000, updatedAt: '2026-01-01' },
  ];

  it('已启用 → true', () => {
    expect(isOverrideEnabled(overrides, 'pause_speed')).toBe(true);
  });

  '已禁用 → false' && it('已禁用 → false', () => {
    expect(isOverrideEnabled(overrides, 'fixed_amount')).toBe(false);
  });

  it('不存在 → false', () => {
    expect(isOverrideEnabled(overrides, 'no_stop_loss')).toBe(false);
  });

  it('空数组 → false', () => {
    expect(isOverrideEnabled([], 'pause_speed')).toBe(false);
  });
});
