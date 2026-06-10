-- 基金历史净值表（用于计算收益率）
CREATE TABLE IF NOT EXISTS fund_nav_history (
  id            SERIAL PRIMARY KEY,
  fund_code     VARCHAR(20) NOT NULL,
  nav_date      DATE NOT NULL,
  nav_unit      NUMERIC(10,4) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fund_code, nav_date)
);

CREATE INDEX IF NOT EXISTS idx_fund_nav_history_code_date ON fund_nav_history(fund_code, nav_date DESC);
