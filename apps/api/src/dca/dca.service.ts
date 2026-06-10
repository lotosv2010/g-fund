import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { DcaCalculation, FundPhase } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

// 定投系数配置
const DCA_MULTIPLIERS = {
  // P2: 估值百分位系数（越低估越加倍）
  valuation: (percentile: number): number => {
    if (percentile <= 20) return 2.0;   // 极度低估
    if (percentile <= 40) return 1.5;   // 低估
    if (percentile <= 60) return 1.0;   // 正常
    if (percentile <= 80) return 0.5;   // 高估
    return 0.2;                         // 极度高估
  },

  // P3: 阶段系数
  phase: (phase: FundPhase | null): number => {
    switch (phase) {
      case 'low': return 1.5;
      case 'normal': return 1.0;
      case 'high': return 0.5;
      default: return 1.0;
    }
  },

  // P4: 优先级系数（优先级越高越加码）
  priority: (priority: number): number => {
    if (priority >= 3) return 1.5;
    if (priority >= 2) return 1.2;
    if (priority >= 1) return 1.0;
    return 0.8;
  },
};

// 定投限制
const DCA_LIMITS = {
  maxMultiplier: 3.0,    // 上限 3 倍
  minThreshold: 0.10,    // 下限 10%（低于此值跳过）
};

@Injectable()
export class DcaService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async calculate(): Promise<DcaCalculation[]> {
    // 获取所有基金
    const funds = await this.db
      .select()
      .from(schema.funds);

    const calculations: DcaCalculation[] = [];

    for (const fund of funds) {
      const baseAmount = parseFloat(fund.baseAmount ?? '0');
      if (baseAmount <= 0) continue;

      // 计算 P2（估值百分位系数）
      const valuationPercentile = fund.valuationPercentile
        ? parseFloat(fund.valuationPercentile)
        : null;
      const p2 = valuationPercentile !== null
        ? DCA_MULTIPLIERS.valuation(valuationPercentile)
        : 1.0;

      // 计算 P3（阶段系数）
      const phase = fund.phase as FundPhase | null;
      const p3 = DCA_MULTIPLIERS.phase(phase);

      // 计算 P4（优先级系数）
      const p4 = DCA_MULTIPLIERS.priority(fund.priority ?? 0);

      // 计算最终金额
      let finalAmount = baseAmount * p2 * p3 * p4;

      // 应用上限
      const maxAmount = baseAmount * DCA_LIMITS.maxMultiplier;
      if (finalAmount > maxAmount) {
        finalAmount = maxAmount;
      }

      // 检查下限（跳过阈值）
      const ratio = finalAmount / baseAmount;
      const skipped = ratio < DCA_LIMITS.minThreshold;

      calculations.push({
        fundCode: fund.code,
        fundName: fund.name,
        baseAmount: baseAmount.toFixed(2),
        valuationPercentile: fund.valuationPercentile ?? null,
        phase,
        priority: fund.priority ?? 0,
        p2,
        p3,
        p4,
        finalAmount: finalAmount.toFixed(2),
        skipped,
        skipReason: skipped ? '定投金额低于基础金额的10%，跳过' : undefined,
      });
    }

    return calculations;
  }

  async calculateByFund(fundCode: string): Promise<DcaCalculation | null> {
    const allCalculations = await this.calculate();
    return allCalculations.find((c) => c.fundCode === fundCode) ?? null;
  }
}
