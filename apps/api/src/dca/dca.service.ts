import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { RulesService } from '../rules/rules.service';
import { DcaCalculation, FundPhase, ValuationLevel } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

@Injectable()
export class DcaService {
  constructor(
    @Inject(DB) private readonly db: DbType,
    private readonly rulesService: RulesService,
  ) {}

  async calculate(): Promise<DcaCalculation[]> {
    const rules = await this.rulesService.getDcaRules();

    const funds = await this.db
      .select()
      .from(schema.funds);

    const calculations: DcaCalculation[] = [];

    for (const fund of funds) {
      const baseAmount = parseFloat(fund.baseAmount ?? '0');
      if (baseAmount <= 0) continue;

      const valuationPercentile = fund.valuationPercentile
        ? parseFloat(fund.valuationPercentile)
        : null;
      const p2 = valuationPercentile !== null
        ? this.calcP2(valuationPercentile, rules.valuationPercentiles)
        : 1.0;

      const valuationLevel = (fund.valuationLevel ?? fund.phase) as ValuationLevel | null;
      const p3 = valuationLevel
        ? (rules.valuationLevelMultipliers[valuationLevel] ?? 1.0)
        : 1.0;

      const p4 = this.calcP4(fund.priority ?? 0, rules.priorityMultipliers);

      let finalAmount = baseAmount * p2 * p3 * p4;

      const maxAmount = baseAmount * rules.maxMultiplier;
      if (finalAmount > maxAmount) {
        finalAmount = maxAmount;
      }

      const ratio = finalAmount / baseAmount;
      const skipped = ratio < rules.minThreshold;

      calculations.push({
        fundCode: fund.code,
        fundName: fund.name,
        baseAmount: baseAmount.toFixed(2),
        valuationPercentile: fund.valuationPercentile ?? null,
        phase: valuationLevel as FundPhase | null,
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

  private calcP2(percentile: number, rules: Array<{ max: number; multiplier: number }>): number {
    for (const rule of rules) {
      if (percentile <= rule.max) return rule.multiplier;
    }
    return rules[rules.length - 1]?.multiplier ?? 1.0;
  }

  private calcP4(priority: number, rules: Array<{ minPriority: number; multiplier: number }>): number {
    for (const rule of rules) {
      if (priority >= rule.minPriority) return rule.multiplier;
    }
    return rules[rules.length - 1]?.multiplier ?? 1.0;
  }
}
