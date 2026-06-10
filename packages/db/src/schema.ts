import { pgTable, serial, varchar, numeric, smallint, text, timestamp, date, integer, jsonb, boolean } from 'drizzle-orm/pg-core';

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
