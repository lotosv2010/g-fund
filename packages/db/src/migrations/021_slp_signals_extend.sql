-- M13: 扩展 slp_signals_log 表，支持深度套牢决策和观望升级记录
-- 添加字段：deep_loss_decision, watch_days, stop_loss_trigger_price

ALTER TABLE slp_signals_log
ADD COLUMN IF NOT EXISTS deep_loss_decision VARCHAR(1),
ADD COLUMN IF NOT EXISTS watch_days INTEGER,
ADD COLUMN IF NOT EXISTS stop_loss_trigger_price NUMERIC(18, 4);

-- 添加注释
COMMENT ON COLUMN slp_signals_log.deep_loss_decision IS '深度套牢决策: A=补仓, B=观望, C=止损';
COMMENT ON COLUMN slp_signals_log.watch_days IS '观望天数（连续观望计数）';
COMMENT ON COLUMN slp_signals_log.stop_loss_trigger_price IS '止损触发价（观望升级时计算）';
