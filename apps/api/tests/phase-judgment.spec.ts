import { describe, it, expect } from 'vitest';

// 阶段判断逻辑：costAmount / targetAmount >= 0.8 → holding，否则 dca

function judgeLifecycleStage(
  costAmount: number,
  targetAmount: number,
): 'dca' | 'holding' {
  if (targetAmount <= 0) return 'dca';
  const progress = costAmount / targetAmount;
  return progress >= 0.8 ? 'holding' : 'dca';
}

describe('阶段判断（lifecycle stage）', () => {
  it('79.9% → dca', () => {
    expect(judgeLifecycleStage(79.9, 100)).toBe('dca');
  });

  it('80.0% → holding（边界）', () => {
    expect(judgeLifecycleStage(80, 100)).toBe('holding');
  });

  it('80.1% → holding', () => {
    expect(judgeLifecycleStage(80.1, 100)).toBe('holding');
  });

  it('50% → dca', () => {
    expect(judgeLifecycleStage(50, 100)).toBe('dca');
  });

  it('100% → holding', () => {
    expect(judgeLifecycleStage(100, 100)).toBe('holding');
  });

  it('超过 100% → holding', () => {
    expect(judgeLifecycleStage(120, 100)).toBe('holding');
  });

  it('target 为 0 → dca（防止除零）', () => {
    expect(judgeLifecycleStage(50, 0)).toBe('dca');
  });

  it('target 为负 → dca', () => {
    expect(judgeLifecycleStage(50, -100)).toBe('dca');
  });

  it('cost 为 0 → dca', () => {
    expect(judgeLifecycleStage(0, 100)).toBe('dca');
  });
});
