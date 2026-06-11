-- ADR-013: funds.phase 语义拆分 + asset_type 字段扩展
-- 拆分：phase（混合语义）→ valuation_level（估值水平） + lifecycle_stage（生命周期阶段）
-- 扩展：asset_type（资产类型）+ stage_changed_at（阶段切换时间）
-- 旧 phase 列保留至 M11 后 drop（双写期，回滚窗口）

ALTER TABLE funds
  ADD COLUMN IF NOT EXISTS valuation_level   VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lifecycle_stage   VARCHAR(20) NOT NULL DEFAULT 'dca',
  ADD COLUMN IF NOT EXISTS asset_type        VARCHAR(20) NOT NULL DEFAULT 'equity',
  ADD COLUMN IF NOT EXISTS stage_changed_at  TIMESTAMPTZ;

-- 数据回填：valuation_level 直接继承旧 phase 值
UPDATE funds SET valuation_level = phase WHERE valuation_level IS NULL;

-- 数据回填：lifecycle_stage 按 (持仓成本 / 目标金额) >= 0.8 切到 holding
UPDATE funds f
SET lifecycle_stage = 'holding',
    stage_changed_at = NOW()
FROM positions p
WHERE p.fund_code = f.code
  AND f.target_amount > 0
  AND (p.cost_amount / f.target_amount) >= 0.8;

-- 约束：valuation_level 枚举
ALTER TABLE funds
  ADD CONSTRAINT funds_valuation_level_check
  CHECK (valuation_level IN ('low', 'normal', 'high') OR valuation_level IS NULL);

-- 约束：lifecycle_stage 枚举
ALTER TABLE funds
  ADD CONSTRAINT funds_lifecycle_stage_check
  CHECK (lifecycle_stage IN ('dca', 'holding'));

-- 约束：asset_type 枚举
ALTER TABLE funds
  ADD CONSTRAINT funds_asset_type_check
  CHECK (asset_type IN ('equity', 'bond', 'gold', 'qdii', 'index'));

-- 索引：阶段查询、资产类型筛选
CREATE INDEX IF NOT EXISTS idx_funds_lifecycle_stage ON funds(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_funds_asset_type ON funds(asset_type);
