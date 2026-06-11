-- T12.1.10 dca_snapshots 唯一约束（支持 UPSERT）
CREATE UNIQUE INDEX IF NOT EXISTS idx_dca_snapshots_date_fund ON dca_snapshots(plan_date, fund_code);

-- T12.1.3 P1 大盘检查阈值
INSERT INTO dca_rules (rule_group, rule_key, value, default_value) VALUES
  ('p1', 'thresholds', '{"up":2,"down":-2}', '{"up":2,"down":-2}')
ON CONFLICT (rule_group, rule_key) DO NOTHING;

-- T12.1.4 T 因子大盘趋势阈值
INSERT INTO dca_rules (rule_group, rule_key, value, default_value) VALUES
  ('t_factor', 'thresholds', '{"bullMarket":5,"bearMarket":5}', '{"bullMarket":5,"bearMarket":5}')
ON CONFLICT (rule_group, rule_key) DO NOTHING;

-- T12.1.1 双周四锚点日期
INSERT INTO dca_rules (rule_group, rule_key, value, default_value) VALUES
  ('dca', 'biweekly_anchor', '"2026-05-28"', '"2026-05-28"')
ON CONFLICT (rule_group, rule_key) DO NOTHING;
