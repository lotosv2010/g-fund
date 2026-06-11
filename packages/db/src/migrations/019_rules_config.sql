-- T11.1.1 定投规则表
CREATE TABLE IF NOT EXISTS dca_rules (
  rule_group    VARCHAR(20) NOT NULL,
  rule_key      VARCHAR(30) NOT NULL,
  value         JSONB NOT NULL,
  default_value JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rule_group, rule_key)
);

-- T11.1.2 止盈止损规则表
CREATE TABLE IF NOT EXISTS slp_rules (
  rule_group    VARCHAR(20) NOT NULL,
  rule_key      VARCHAR(30) NOT NULL,
  value         JSONB NOT NULL,
  default_value JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rule_group, rule_key)
);

-- T11.1.3 单基金例外规则表
CREATE TABLE IF NOT EXISTS fund_rule_overrides (
  fund_code     VARCHAR(20) NOT NULL,
  override_type VARCHAR(30) NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  value         JSONB,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fund_code, override_type)
);

-- T11.1.4 止盈止损信号日志表
CREATE TABLE IF NOT EXISTS slp_signals_log (
  id           SERIAL PRIMARY KEY,
  fund_code    VARCHAR(20) NOT NULL,
  signal_type  VARCHAR(20) NOT NULL,
  level        VARCHAR(10) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pnl_rate     NUMERIC(8,4),
  message      TEXT,
  resolved     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_slp_signals_fund ON slp_signals_log(fund_code, triggered_at DESC);

-- T11.1.5 定投快照表
CREATE TABLE IF NOT EXISTS dca_snapshots (
  id            SERIAL PRIMARY KEY,
  plan_date     DATE NOT NULL,
  fund_code     VARCHAR(20) NOT NULL,
  base_amount   NUMERIC(18,2),
  p0            NUMERIC(8,4),
  p1            NUMERIC(8,4),
  p2            NUMERIC(8,4),
  p3            NUMERIC(8,4),
  p4            NUMERIC(8,4),
  t_factor      NUMERIC(8,4),
  final_amount  NUMERIC(18,2),
  executed      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dca_snapshots_date ON dca_snapshots(plan_date DESC);

-- Seed DCA 规则默认值
INSERT INTO dca_rules (rule_group, rule_key, value, default_value) VALUES
  ('p2', 'valuation_percentiles',
    '[{"max":20,"multiplier":2.0},{"max":40,"multiplier":1.5},{"max":60,"multiplier":1.0},{"max":80,"multiplier":0.5},{"max":100,"multiplier":0.2}]',
    '[{"max":20,"multiplier":2.0},{"max":40,"multiplier":1.5},{"max":60,"multiplier":1.0},{"max":80,"multiplier":0.5},{"max":100,"multiplier":0.2}]'
  ),
  ('p3', 'valuation_level',
    '{"low":1.5,"normal":1.0,"high":0.5}',
    '{"low":1.5,"normal":1.0,"high":0.5}'
  ),
  ('p4', 'priority',
    '[{"minPriority":3,"multiplier":1.5},{"minPriority":2,"multiplier":1.2},{"minPriority":1,"multiplier":1.0},{"minPriority":0,"multiplier":0.8}]',
    '[{"minPriority":3,"multiplier":1.5},{"minPriority":2,"multiplier":1.2},{"minPriority":1,"multiplier":1.0},{"minPriority":0,"multiplier":0.8}]'
  ),
  ('limits', 'max_multiplier', '3.0', '3.0'),
  ('limits', 'min_threshold', '0.10', '0.10')
ON CONFLICT (rule_group, rule_key) DO NOTHING;

-- Seed 止盈止损规则默认值
INSERT INTO slp_rules (rule_group, rule_key, value, default_value) VALUES
  ('take_profit', 'tiers',
    '[{"level":"green","threshold":0.25},{"level":"yellow","threshold":0.40},{"level":"red","threshold":0.60}]',
    '[{"level":"green","threshold":0.25},{"level":"yellow","threshold":0.40},{"level":"red","threshold":0.60}]'
  ),
  ('stop_loss', 'tiers',
    '[{"level":"yellow","threshold":-0.10},{"level":"red","threshold":-0.20}]',
    '[{"level":"yellow","threshold":-0.10},{"level":"red","threshold":-0.20}]'
  ),
  ('deep_loss', 'threshold', '-0.20', '-0.20'),
  ('warning', 'threshold', '-0.08', '-0.08'),
  ('rebound', 'daily',
    '{"days":3,"threshold":0.01}',
    '{"days":3,"threshold":0.01}'
  ),
  ('rebound', 'weekly',
    '{"days":7,"threshold":0.03}',
    '{"days":7,"threshold":0.03}'
  )
ON CONFLICT (rule_group, rule_key) DO NOTHING;

-- T11.1.9 子弹仓配置
INSERT INTO app_settings (key, value)
VALUES ('bullet_reserve', '{"amount":0,"lastTriggeredDate":null}')
ON CONFLICT (key) DO NOTHING;
