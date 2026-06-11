import { describe, it, expect } from 'vitest';
import {
  computeAlertSignal,
  computeNextTierGap,
  isLowValuationIndex,
} from '../src/stop-loss-take-profit/slp-calc';
import { DEFAULT_SLP_RULES } from '@g-fund/types';
import type { SlpRules } from '@g-fund/types';

const rules = DEFAULT_SLP_RULES as SlpRules;

// ── 四态预警信号 ──

describe('computeAlertSignal', () => {
  it('收益率接近止盈线 → red / warning', () => {
    const result = computeAlertSignal(0.24, rules, null);
    expect(result.level).toBe('red');
    expect(result.signalType).toBe('warning');
    expect(result.message).toContain('止盈');
  });

  it('收益率接近止损线 → yellow / warning', () => {
    const result = computeAlertSignal(-0.09, rules, null);
    expect(result.level).toBe('yellow');
    expect(result.signalType).toBe('warning');
    expect(result.message).toContain('止损');
  });

  it('低估区间 → blue / warning', () => {
    const result = computeAlertSignal(0.02, rules, 20);
    expect(result.level).toBe('blue');
    expect(result.signalType).toBe('warning');
    expect(result.message).toContain('低估');
  });

  it('正常区间 → green / warning', () => {
    const result = computeAlertSignal(0.05, rules, 50);
    expect(result.level).toBe('green');
    expect(result.signalType).toBe('warning');
    expect(result.message).toContain('正常');
  });

  it('dca 阶段仍输出信号（level 不变）', () => {
    const result = computeAlertSignal(0.24, rules, null);
    expect(result.level).toBe('red');
  });
});

// ── 距离下一档差距 ──

describe('computeNextTierGap', () => {
  const tiers = [
    { threshold: 0.25 },
    { threshold: 0.40 },
    { threshold: 0.60 },
  ];

  it('止盈：当前在第一档，距下一档', () => {
    const gap = computeNextTierGap(0.25, tiers, 0, 'take_profit');
    expect(gap).toBeDefined();
    expect(gap!).toBeCloseTo((0.40 - 0.25) / 0.25 * 100, 1);
  });

  it('止盈：已在最高档 → undefined', () => {
    const gap = computeNextTierGap(0.60, tiers, 2, 'take_profit');
    expect(gap).toBeUndefined();
  });

  it('止损：当前在第一档，距下一档', () => {
    const slTiers = [
      { threshold: -0.10 },
      { threshold: -0.20 },
    ];
    const gap = computeNextTierGap(-0.10, slTiers, 0, 'stop_loss');
    expect(gap).toBeDefined();
  });
});

// ── 低估指数基金判断 ──

describe('isLowValuationIndex', () => {
  it('指数基金 + 低估 → true', () => {
    expect(isLowValuationIndex('index', 20)).toBe(true);
  });

  it('指数基金 + 估值 30% → false（边界）', () => {
    expect(isLowValuationIndex('index', 30)).toBe(false);
  });

  it('指数基金 + 无估值 → false', () => {
    expect(isLowValuationIndex('index', null)).toBe(false);
  });

  it('非指数基金 → false', () => {
    expect(isLowValuationIndex('equity', 20)).toBe(false);
  });
});
