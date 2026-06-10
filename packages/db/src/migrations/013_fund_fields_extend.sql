-- funds 表扩展：止盈止损与定投所需字段
ALTER TABLE funds
  ADD COLUMN IF NOT EXISTS valuation_percentile NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phase VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_return NUMERIC(8,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_return NUMERIC(8,4) DEFAULT NULL;

-- 添加 phase 枚举约束
ALTER TABLE funds
  ADD CONSTRAINT funds_phase_check
  CHECK (phase IN ('low', 'normal', 'high') OR phase IS NULL);

-- 添加索引用于定投优先级排序
CREATE INDEX IF NOT EXISTS idx_funds_priority ON funds(priority DESC);
