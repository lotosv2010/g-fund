-- positions 表加入"当前市值/最近净值"列（衍生量，由同步写入）
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS current_value numeric(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nav_unit numeric(10, 4),
  ADD COLUMN IF NOT EXISTS nav_date date;

-- 移除 funds 上的金额字段（彻底分层）
ALTER TABLE funds
  DROP COLUMN IF EXISTS cost_amount,
  DROP COLUMN IF EXISTS current_value;

-- positions 允许 cost_price 为 0（建仓时还没买入的快照）
ALTER TABLE positions
  ALTER COLUMN cost_price SET DEFAULT 0;
