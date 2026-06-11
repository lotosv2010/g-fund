import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import type {
  DcaRules,
  SlpRules,
  FundRuleOverride,
  FundRuleOverrideType,
  ValuationLevel,
} from '@g-fund/types';
import { DEFAULT_DCA_RULES, DEFAULT_SLP_RULES } from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;

@Injectable()
export class RulesService {
  private dcaCache: DcaRules | null = null;
  private slpCache: SlpRules | null = null;

  constructor(@Inject(DB) private readonly db: DbType) {}

  async getDcaRules(): Promise<DcaRules> {
    if (this.dcaCache) return this.dcaCache;

    const rows = await this.db
      .select()
      .from(schema.dcaRules);

    if (rows.length === 0) {
      this.dcaCache = { ...DEFAULT_DCA_RULES };
      return this.dcaCache;
    }

    const map = new Map<string, unknown>();
    for (const row of rows) {
      map.set(`${row.ruleGroup}.${row.ruleKey}`, row.value);
    }

    this.dcaCache = {
      valuationPercentiles: (map.get('p2.valuation_percentiles') as DcaRules['valuationPercentiles']) ?? DEFAULT_DCA_RULES.valuationPercentiles,
      valuationLevelMultipliers: (map.get('p3.valuation_level') as Record<ValuationLevel, number>) ?? DEFAULT_DCA_RULES.valuationLevelMultipliers,
      priorityMultipliers: (map.get('p4.priority') as DcaRules['priorityMultipliers']) ?? DEFAULT_DCA_RULES.priorityMultipliers,
      maxMultiplier: Number(map.get('limits.max_multiplier') ?? DEFAULT_DCA_RULES.maxMultiplier),
      minThreshold: Number(map.get('limits.min_threshold') ?? DEFAULT_DCA_RULES.minThreshold),
      p1Thresholds: (map.get('p1.thresholds') as DcaRules['p1Thresholds']) ?? DEFAULT_DCA_RULES.p1Thresholds,
      tFactorThresholds: (map.get('t_factor.thresholds') as DcaRules['tFactorThresholds']) ?? DEFAULT_DCA_RULES.tFactorThresholds,
      biweeklyAnchorDate: String(map.get('dca.biweekly_anchor') ?? DEFAULT_DCA_RULES.biweeklyAnchorDate),
    };

    return this.dcaCache;
  }

  async setDcaRules(rules: DcaRules): Promise<void> {
    const entries: Array<{ ruleGroup: string; ruleKey: string; value: unknown; defaultValue: unknown }> = [
      { ruleGroup: 'p2', ruleKey: 'valuation_percentiles', value: rules.valuationPercentiles, defaultValue: DEFAULT_DCA_RULES.valuationPercentiles },
      { ruleGroup: 'p3', ruleKey: 'valuation_level', value: rules.valuationLevelMultipliers, defaultValue: DEFAULT_DCA_RULES.valuationLevelMultipliers },
      { ruleGroup: 'p4', ruleKey: 'priority', value: rules.priorityMultipliers, defaultValue: DEFAULT_DCA_RULES.priorityMultipliers },
      { ruleGroup: 'limits', ruleKey: 'max_multiplier', value: rules.maxMultiplier, defaultValue: DEFAULT_DCA_RULES.maxMultiplier },
      { ruleGroup: 'limits', ruleKey: 'min_threshold', value: rules.minThreshold, defaultValue: DEFAULT_DCA_RULES.minThreshold },
      { ruleGroup: 'p1', ruleKey: 'thresholds', value: rules.p1Thresholds, defaultValue: DEFAULT_DCA_RULES.p1Thresholds },
      { ruleGroup: 't_factor', ruleKey: 'thresholds', value: rules.tFactorThresholds, defaultValue: DEFAULT_DCA_RULES.tFactorThresholds },
      { ruleGroup: 'dca', ruleKey: 'biweekly_anchor', value: rules.biweeklyAnchorDate, defaultValue: DEFAULT_DCA_RULES.biweeklyAnchorDate },
    ];

    for (const entry of entries) {
      await this.db
        .insert(schema.dcaRules)
        .values(entry)
        .onConflictDoUpdate({
          target: [schema.dcaRules.ruleGroup, schema.dcaRules.ruleKey],
          set: { value: entry.value as never, updatedAt: new Date() },
        });
    }

    this.dcaCache = { ...rules };
  }

  async resetDcaRules(): Promise<DcaRules> {
    await this.setDcaRules(DEFAULT_DCA_RULES);
    this.dcaCache = null;
    return this.getDcaRules();
  }

  async getSlpRules(): Promise<SlpRules> {
    if (this.slpCache) return this.slpCache;

    const rows = await this.db
      .select()
      .from(schema.slpRules);

    if (rows.length === 0) {
      this.slpCache = { ...DEFAULT_SLP_RULES };
      return this.slpCache;
    }

    const map = new Map<string, unknown>();
    for (const row of rows) {
      map.set(`${row.ruleGroup}.${row.ruleKey}`, row.value);
    }

    this.slpCache = {
      takeProfitTiers: (map.get('take_profit.tiers') as SlpRules['takeProfitTiers']) ?? DEFAULT_SLP_RULES.takeProfitTiers,
      stopLossTiers: (map.get('stop_loss.tiers') as SlpRules['stopLossTiers']) ?? DEFAULT_SLP_RULES.stopLossTiers,
      deepLossThreshold: Number(map.get('deep_loss.threshold') ?? DEFAULT_SLP_RULES.deepLossThreshold),
      warningThreshold: Number(map.get('warning.threshold') ?? DEFAULT_SLP_RULES.warningThreshold),
      reboundDaily: (map.get('rebound.daily') as SlpRules['reboundDaily']) ?? DEFAULT_SLP_RULES.reboundDaily,
      reboundWeekly: (map.get('rebound.weekly') as SlpRules['reboundWeekly']) ?? DEFAULT_SLP_RULES.reboundWeekly,
      alertThresholds: (map.get('alert.thresholds') as SlpRules['alertThresholds']) ?? DEFAULT_SLP_RULES.alertThresholds,
      deepLossDecision: (map.get('deep_loss.decision') as SlpRules['deepLossDecision']) ?? DEFAULT_SLP_RULES.deepLossDecision,
    };

    return this.slpCache;
  }

  async setSlpRules(rules: SlpRules): Promise<void> {
    const entries = [
      { ruleGroup: 'take_profit', ruleKey: 'tiers', value: rules.takeProfitTiers, defaultValue: DEFAULT_SLP_RULES.takeProfitTiers },
      { ruleGroup: 'stop_loss', ruleKey: 'tiers', value: rules.stopLossTiers, defaultValue: DEFAULT_SLP_RULES.stopLossTiers },
      { ruleGroup: 'deep_loss', ruleKey: 'threshold', value: rules.deepLossThreshold, defaultValue: DEFAULT_SLP_RULES.deepLossThreshold },
      { ruleGroup: 'warning', ruleKey: 'threshold', value: rules.warningThreshold, defaultValue: DEFAULT_SLP_RULES.warningThreshold },
      { ruleGroup: 'rebound', ruleKey: 'daily', value: rules.reboundDaily, defaultValue: DEFAULT_SLP_RULES.reboundDaily },
      { ruleGroup: 'rebound', ruleKey: 'weekly', value: rules.reboundWeekly, defaultValue: DEFAULT_SLP_RULES.reboundWeekly },
      { ruleGroup: 'alert', ruleKey: 'thresholds', value: rules.alertThresholds, defaultValue: DEFAULT_SLP_RULES.alertThresholds },
      { ruleGroup: 'deep_loss', ruleKey: 'decision', value: rules.deepLossDecision, defaultValue: DEFAULT_SLP_RULES.deepLossDecision },
    ];

    for (const entry of entries) {
      await this.db
        .insert(schema.slpRules)
        .values(entry)
        .onConflictDoUpdate({
          target: [schema.slpRules.ruleGroup, schema.slpRules.ruleKey],
          set: { value: entry.value as never, updatedAt: new Date() },
        });
    }

    this.slpCache = { ...rules };
  }

  async resetSlpRules(): Promise<SlpRules> {
    await this.setSlpRules(DEFAULT_SLP_RULES);
    this.slpCache = null;
    return this.getSlpRules();
  }

  async getFundOverrides(fundCode: string): Promise<FundRuleOverride[]> {
    const rows = await this.db
      .select()
      .from(schema.fundRuleOverrides)
      .where(eq(schema.fundRuleOverrides.fundCode, fundCode));

    return rows.map((r) => ({
      fundCode: r.fundCode,
      overrideType: r.overrideType as FundRuleOverrideType,
      enabled: r.enabled,
      value: r.value !== null ? Number(r.value) : null,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getAllFundOverrides(fundCodes: string[]): Promise<Map<string, FundRuleOverride[]>> {
    const map = new Map<string, FundRuleOverride[]>();
    if (fundCodes.length === 0) return map;

    const rows = await this.db
      .select()
      .from(schema.fundRuleOverrides)
      .where(inArray(schema.fundRuleOverrides.fundCode, fundCodes));

    for (const r of rows) {
      const existing = map.get(r.fundCode) ?? [];
      existing.push({
        fundCode: r.fundCode,
        overrideType: r.overrideType as FundRuleOverrideType,
        enabled: r.enabled,
        value: r.value !== null ? Number(r.value) : null,
        updatedAt: r.updatedAt.toISOString(),
      });
      map.set(r.fundCode, existing);
    }

    return map;
  }

  async setFundOverride(
    fundCode: string,
    overrideType: FundRuleOverrideType,
    enabled: boolean,
    value?: number | null,
  ): Promise<FundRuleOverride> {
    const [row] = await this.db
      .insert(schema.fundRuleOverrides)
      .values({ fundCode, overrideType, enabled, value: value ?? null })
      .onConflictDoUpdate({
        target: [schema.fundRuleOverrides.fundCode, schema.fundRuleOverrides.overrideType],
        set: { enabled, value: value ?? null, updatedAt: new Date() },
      })
      .returning();

    return {
      fundCode: row.fundCode,
      overrideType: row.overrideType as FundRuleOverrideType,
      enabled: row.enabled,
      value: row.value !== null ? Number(row.value) : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  invalidateCache(): void {
    this.dcaCache = null;
    this.slpCache = null;
  }
}
