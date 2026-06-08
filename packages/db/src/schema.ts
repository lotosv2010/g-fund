import { pgTable, serial, varchar, numeric, smallint, text, timestamp } from 'drizzle-orm/pg-core';

export const funds = pgTable('funds', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }),
  riskLevel: smallint('risk_level'),
  category: varchar('category', { length: 20 }).notNull().default('holding'),
  costAmount: numeric('cost_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  currentValue: numeric('current_value', { precision: 18, scale: 2 }).notNull().default('0'),
  targetAmount: numeric('target_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  targetRatio: numeric('target_ratio', { precision: 5, scale: 2 }).notNull().default('0'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  fundCode: varchar('fund_code', { length: 20 }).notNull().unique(),
  fundName: varchar('fund_name', { length: 100 }).notNull(),
  shares: numeric('shares', { precision: 18, scale: 4 }).notNull().default('0'),
  costPrice: numeric('cost_price', { precision: 10, scale: 4 }).notNull(),
  costAmount: numeric('cost_amount', { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
