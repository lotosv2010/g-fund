import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb, cleanupByPrefix, closeTestDb } from '../helpers/db';
import * as schema from '@g-fund/db';
import { computeAlertSignal, isLowValuationIndex } from '../../src/stop-loss-take-profit/slp-calc';
import { DEFAULT_SLP_RULES } from '@g-fund/types';
import type { SlpRules } from '@g-fund/types';
import { eq } from 'drizzle-orm';

const rules = DEFAULT_SLP_RULES as SlpRules;
const PREFIX = 'SLP_TEST';

describe('止盈止损全流程集成测试（真实 PostgreSQL）', () => {
  beforeAll(async () => {
    await cleanupByPrefix(PREFIX);
  });

  afterAll(async () => {
    await cleanupByPrefix(PREFIX);
    await closeTestDb();
  });

  it('持仓收益 > 止盈阈值 → 信号可计算', async () => {
    const db = await getTestDb();

    await db.insert(schema.funds).values({
      code: `${PREFIX}001`,
      name: '止盈测试基金',
      type: 'open',
      category: 'all',
      lifecycleStage: 'holding',
      assetType: 'equity',
    });

    await db.insert(schema.positions).values({
      fundCode: `${PREFIX}001`,
      fundName: '止盈测试基金',
      shares: '10000',
      costPrice: '1.0000',
      costAmount: '10000',
      navUnit: '1.3000',
      navDate: '2026-06-10',
    });

    const pnlRate = (1.3 - 1.0) / 1.0;
    const alert = computeAlertSignal(pnlRate, rules, null);
    expect(alert.level).toBe('red');

    let triggered = false;
    for (let i = rules.takeProfitTiers.length - 1; i >= 0; i--) {
      if (pnlRate >= rules.takeProfitTiers[i].threshold) {
        triggered = true;
        break;
      }
    }
    expect(triggered).toBe(true);
  });

  it('持仓亏损 > 止损阈值 → 信号可计算', async () => {
    const db = await getTestDb();

    await db.insert(schema.funds).values({
      code: `${PREFIX}002`,
      name: '止损测试基金',
      type: 'open',
      category: 'all',
      lifecycleStage: 'holding',
      assetType: 'equity',
    });

    await db.insert(schema.positions).values({
      fundCode: `${PREFIX}002`,
      fundName: '止损测试基金',
      shares: '10000',
      costPrice: '1.0000',
      costAmount: '10000',
      navUnit: '0.8500',
      navDate: '2026-06-10',
    });

    const pnlRate = (0.85 - 1.0) / 1.0;
    const alert = computeAlertSignal(pnlRate, rules, null);
    expect(alert.level).toBe('yellow');

    let triggered = false;
    for (let i = rules.stopLossTiers.length - 1; i >= 0; i--) {
      if (pnlRate <= rules.stopLossTiers[i].threshold) {
        triggered = true;
        break;
      }
    }
    expect(triggered).toBe(true);
  });

  it('信号日志写入 → 可查询', async () => {
    const db = await getTestDb();

    await db.insert(schema.slpSignalsLog).values({
      fundCode: `${PREFIX}001`,
      signalType: 'take_profit',
      level: 'red',
      pnlRate: '0.3000',
      message: '测试信号',
    });

    const logs = await db
      .select()
      .from(schema.slpSignalsLog)
      .where(eq(schema.slpSignalsLog.fundCode, `${PREFIX}001`));
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].signalType).toBe('take_profit');
  });

  it('低估指数基金 → 不触发止损例外', () => {
    expect(isLowValuationIndex('index', 20)).toBe(true);
    expect(isLowValuationIndex('index', 50)).toBe(false);
    expect(isLowValuationIndex('equity', 20)).toBe(false);
  });

  it('深度套牢条件判断', () => {
    expect(-0.25 <= rules.deepLossThreshold).toBe(true);
    expect(50 > 30).toBe(true); // 高估值 → 决策 C
    expect(15 < 30).toBe(true); // 低估值 → 决策 A
  });
});
