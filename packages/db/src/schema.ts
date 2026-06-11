import { pgTable, serial, varchar, numeric, smallint, text, timestamp, date, integer, jsonb, boolean, unique } from 'drizzle-orm/pg-core';

export const funds = pgTable('funds', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }),
  riskLevel: smallint('risk_level'),
  category: varchar('category', { length: 20 }).notNull().default('all'),
  sortOrder: numeric('sort_order').notNull().default('0'),
  targetAmount: numeric('target_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  targetRatio: numeric('target_ratio', { precision: 5, scale: 2 }).notNull().default('0'),
  valuationPercentile: numeric('valuation_percentile', { precision: 5, scale: 2 }),
  phase: varchar('phase', { length: 20 }).default('normal'),
  valuationLevel: varchar('valuation_level', { length: 20 }),
  lifecycleStage: varchar('lifecycle_stage', { length: 20 }).notNull().default('dca'),
  assetType: varchar('asset_type', { length: 20 }).notNull().default('equity'),
  stageChangedAt: timestamp('stage_changed_at', { withTimezone: true }),
  priority: integer('priority').notNull().default(0),
  baseAmount: numeric('base_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  weeklyReturn: numeric('weekly_return', { precision: 8, scale: 4 }),
  monthlyReturn: numeric('monthly_return', { precision: 8, scale: 4 }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  fundCode: varchar('fund_code', { length: 20 }).notNull().unique(),
  fundName: varchar('fund_name', { length: 100 }).notNull(),
  shares: numeric('shares', { precision: 18, scale: 4 }).notNull().default('0'),
  costPrice: numeric('cost_price', { precision: 10, scale: 4 }).notNull().default('0'),
  costAmount: numeric('cost_amount', { precision: 18, scale: 2 }).notNull(),
  currentValue: numeric('current_value', { precision: 18, scale: 2 }).notNull().default('0'),
  navUnit: numeric('nav_unit', { precision: 10, scale: 4 }),
  navDate: date('nav_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  fundCode: varchar('fund_code', { length: 20 }).notNull(),
  fundName: varchar('fund_name', { length: 100 }).notNull(),
  type: varchar('type', { length: 4 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  shares: numeric('shares', { precision: 18, scale: 4 }),
  price: numeric('price', { precision: 10, scale: 4 }),
  tradeDate: date('trade_date').notNull(),
  note: text('note'),
  status: varchar('status', { length: 10 }).notNull().default('confirmed'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dailyLogs = pgTable('daily_logs', {
  id: serial('id').primaryKey(),
  logDate: date('log_date').notNull().unique(),
  summary: text('summary'),
  marketNote: text('market_note'),
  stageChanges: jsonb('stage_changes').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dailySnapshots = pgTable('daily_snapshots', {
  id: serial('id').primaryKey(),
  snapshotDate: date('snapshot_date').notNull().unique(),
  totalCost: numeric('total_cost', { precision: 18, scale: 2 }).notNull().default('0'),
  totalValue: numeric('total_value', { precision: 18, scale: 2 }).notNull().default('0'),
  totalPnl: numeric('total_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  pnlRatio: numeric('pnl_ratio', { precision: 8, scale: 4 }).notNull().default('0'),
  positionCount: integer('position_count').notNull().default(0),
  positionsSnapshot: jsonb('positions_snapshot'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatSessions = pgTable('chat_sessions', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 120 }).notNull().default('新对话'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).notNull(),
  kind: varchar('kind', { length: 16 }).notNull(),
  content: text('content').notNull(),
  tool: varchar('tool', { length: 80 }),
  truncated: boolean('truncated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fundNavHistory = pgTable('fund_nav_history', {
  id: serial('id').primaryKey(),
  fundCode: varchar('fund_code', { length: 20 }).notNull(),
  navDate: date('nav_date').notNull(),
  navUnit: numeric('nav_unit', { precision: 10, scale: 4 }).notNull(),
  dailyReturn: numeric('daily_return', { precision: 8, scale: 4 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('unique_fund_nav_code_date').on(t.fundCode, t.navDate),
]);

export const marketIndexHistory = pgTable('market_index_history', {
  id: serial('id').primaryKey(),
  indexCode: varchar('index_code', { length: 20 }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  close: numeric('close', { precision: 10, scale: 4 }).notNull(),
  changePct: numeric('change_pct', { precision: 8, scale: 4 }),
  turnover: numeric('turnover', { precision: 18, scale: 2 }),
  tradeDate: date('trade_date').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('unique_market_index_code_date').on(t.indexCode, t.tradeDate),
]);

export const dcaRules = pgTable('dca_rules', {
  ruleGroup: varchar('rule_group', { length: 20 }).notNull(),
  ruleKey: varchar('rule_key', { length: 30 }).notNull(),
  value: jsonb('value').notNull(),
  defaultValue: jsonb('default_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('dca_rules_pkey').on(t.ruleGroup, t.ruleKey),
]);

export const slpRules = pgTable('slp_rules', {
  ruleGroup: varchar('rule_group', { length: 20 }).notNull(),
  ruleKey: varchar('rule_key', { length: 30 }).notNull(),
  value: jsonb('value').notNull(),
  defaultValue: jsonb('default_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('slp_rules_pkey').on(t.ruleGroup, t.ruleKey),
]);

export const fundRuleOverrides = pgTable('fund_rule_overrides', {
  fundCode: varchar('fund_code', { length: 20 }).notNull(),
  overrideType: varchar('override_type', { length: 30 }).notNull(),
  enabled: boolean('enabled').notNull().default(false),
  value: jsonb('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('fund_rule_overrides_pkey').on(t.fundCode, t.overrideType),
]);

export const slpSignalsLog = pgTable('slp_signals_log', {
  id: serial('id').primaryKey(),
  fundCode: varchar('fund_code', { length: 20 }).notNull(),
  signalType: varchar('signal_type', { length: 20 }).notNull(),
  level: varchar('level', { length: 10 }).notNull(),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  pnlRate: numeric('pnl_rate', { precision: 8, scale: 4 }),
  message: text('message'),
  resolved: boolean('resolved').notNull().default(false),
  deepLossDecision: varchar('deep_loss_decision', { length: 1 }), // A/B/C
  watchDays: integer('watch_days'), // 观望天数
  stopLossTriggerPrice: numeric('stop_loss_trigger_price', { precision: 18, scale: 4 }), // 止损触发价
});

export const dcaSnapshots = pgTable('dca_snapshots', {
  id: serial('id').primaryKey(),
  planDate: date('plan_date').notNull(),
  fundCode: varchar('fund_code', { length: 20 }).notNull(),
  baseAmount: numeric('base_amount', { precision: 18, scale: 2 }),
  p0: numeric('p0', { precision: 8, scale: 4 }),
  p1: numeric('p1', { precision: 8, scale: 4 }),
  p2: numeric('p2', { precision: 8, scale: 4 }),
  p3: numeric('p3', { precision: 8, scale: 4 }),
  p4: numeric('p4', { precision: 8, scale: 4 }),
  tFactor: numeric('t_factor', { precision: 8, scale: 4 }),
  finalAmount: numeric('final_amount', { precision: 18, scale: 2 }),
  executed: boolean('executed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('idx_dca_snapshots_date_fund').on(t.planDate, t.fundCode),
]);
