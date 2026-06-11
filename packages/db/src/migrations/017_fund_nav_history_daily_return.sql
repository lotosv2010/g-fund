-- fund_nav_history 增加 daily_return 字段
ALTER TABLE fund_nav_history ADD COLUMN IF NOT EXISTS daily_return NUMERIC(8,4);

-- 回填历史数据：根据相邻日期净值计算日收益率
UPDATE fund_nav_history AS curr
SET daily_return = (
  (curr.nav_unit - prev.nav_unit) / prev.nav_unit * 100
)
FROM fund_nav_history AS prev
WHERE curr.fund_code = prev.fund_code
  AND prev.nav_date = (
    SELECT MAX(nav_date)
    FROM fund_nav_history
    WHERE fund_code = curr.fund_code
      AND nav_date < curr.nav_date
  )
  AND curr.daily_return IS NULL;
