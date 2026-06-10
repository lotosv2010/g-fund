-- positions 表加入"当前市值/最近净值"列（衍生量，由同步写入）
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS current_value numeric(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nav_unit numeric(10, 4),
  ADD COLUMN IF NOT EXISTS nav_date date;

-- 把 funds 的 current_value 拷贝到对应 positions（流水路径权威，先以 funds 为兜底）
UPDATE positions p
SET current_value = COALESCE(f.current_value, 0)
FROM funds f
WHERE p.fund_code = f.code
  AND p.current_value = 0
  AND COALESCE(f.current_value, 0) > 0;

-- 没有 transactions 流水、但 funds 上录了快照的，补建 positions 行
INSERT INTO positions (fund_code, fund_name, shares, cost_price, cost_amount, current_value, created_at, updated_at)
SELECT
  f.code,
  f.name,
  0,
  0,
  f.cost_amount,
  COALESCE(f.current_value, 0),
  NOW(),
  NOW()
FROM funds f
WHERE COALESCE(f.cost_amount, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.fund_code = f.code);

-- 移除 funds 上的金额字段（彻底分层）
ALTER TABLE funds
  DROP COLUMN IF EXISTS cost_amount,
  DROP COLUMN IF EXISTS current_value;

-- positions 允许 cost_price 为 0（建仓时还没买入的快照）
ALTER TABLE positions
  ALTER COLUMN cost_price SET DEFAULT 0;
