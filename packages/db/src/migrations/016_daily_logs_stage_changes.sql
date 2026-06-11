-- 给 daily_logs 表添加 stage_changes 字段，记录阶段切换事件
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS stage_changes JSONB DEFAULT '[]'::jsonb;

-- 添加注释说明数据结构
COMMENT ON COLUMN daily_logs.stage_changes IS '阶段切换记录数组：[{fundCode, fundName, fromStage, toStage, progress, trigger, timestamp}]';
