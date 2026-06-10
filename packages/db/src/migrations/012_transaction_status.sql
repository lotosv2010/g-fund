-- T+1 交易确认：transactions 表加 status 和 confirmed_at
-- 已有数据默认 status='confirmed'，无需回填

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'confirmed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
