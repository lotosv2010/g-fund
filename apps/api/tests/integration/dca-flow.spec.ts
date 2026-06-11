import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb, cleanupByPrefix, closeTestDb } from '../helpers/db';
import * as schema from '@g-fund/db';
import { calcP2, calcP3MonthlyAdjustment, calcP4 } from '../../src/dca/dca-calc';
import { DEFAULT_DCA_RULES } from '@g-fund/types';

const PREFIX = 'DCA_TEST';

describe('定投全流程集成测试（真实 PostgreSQL）', () => {
  beforeAll(async () => {
    await cleanupByPrefix(PREFIX);
  });

  afterAll(async () => {
    await cleanupByPrefix(PREFIX);
    await closeTestDb();
  });

  it('写入基金 + 持仓 + 净值历史 → DCA 系数可计算', async () => {
    const db = await getTestDb();

    await db.insert(schema.funds).values({
      code: `${PREFIX}001`,
      name: '测试基金A',
      type: 'open',
      category: 'all',
      baseAmount: '1000',
      targetAmount: '50000',
      valuationPercentile: '25',
      valuationLevel: 'low',
      lifecycleStage: 'dca',
      assetType: 'equity',
      priority: 3,
    });

    await db.insert(schema.positions).values({
      fundCode: `${PREFIX}001`,
      fundName: '测试基金A',
      shares: '1000',
      costPrice: '1.0000',
      costAmount: '1000',
      navUnit: '1.0500',
      navDate: '2026-06-10',
    });

    const navEntries = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      navEntries.push({
        fundCode: `${PREFIX}001`,
        navDate: date.toISOString().split('T')[0],
        navUnit: (1.0 + (30 - i) * 0.001).toFixed(4),
        dailyReturn: '0.0010',
      });
    }
    await db.insert(schema.fundNavHistory).values(navEntries);

    const funds = await db.select().from(schema.funds);
    const testFund = funds.find((f) => f.code === `${PREFIX}001`);
    expect(testFund).toBeDefined();

    const p2 = calcP2(25, DEFAULT_DCA_RULES.valuationPercentiles);
    expect(p2).toBeGreaterThan(1.0);

    const p4 = calcP4(3, DEFAULT_DCA_RULES.priorityMultipliers);
    expect(p4).toBeGreaterThanOrEqual(1.0);

    const latestNav = parseFloat(navEntries[navEntries.length - 1].navUnit);
    const oldestNav = parseFloat(navEntries[0].navUnit);
    const monthlyReturn = (latestNav - oldestNav) / oldestNav;
    expect(monthlyReturn).toBeCloseTo(0.03, 1);

    const p3Adj = calcP3MonthlyAdjustment(monthlyReturn);
    expect(p3Adj).toBe(1.0);
  });

  it('写入快照 → 可查询', async () => {
    const db = await getTestDb();

    await db.insert(schema.dcaSnapshots).values({
      planDate: '2026-06-10',
      fundCode: `${PREFIX}001`,
      baseAmount: '1000.00',
      p0: '1.0000', p1: '1.0000', p2: '1.2000',
      p3: '1.0000', p4: '1.1000', tFactor: '1.0000',
      finalAmount: '1320.00',
      executed: false,
    });

    const snapshots = await db.select().from(schema.dcaSnapshots);
    const snap = snapshots.find((s) => s.fundCode === `${PREFIX}001`);
    expect(snap).toBeDefined();
    expect(snap!.finalAmount).toBe('1320.00');
    expect(snap!.executed).toBe(false);
  });
});
