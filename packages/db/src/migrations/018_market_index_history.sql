-- 市场指数历史表
CREATE TABLE IF NOT EXISTS market_index_history (
  id            SERIAL PRIMARY KEY,
  index_code    VARCHAR(20) NOT NULL,
  name          VARCHAR(50) NOT NULL,
  close         NUMERIC(10,4) NOT NULL,
  change_pct    NUMERIC(8,4),
  turnover      NUMERIC(18,2),
  trade_date    DATE NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(index_code, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_market_index_code_date ON market_index_history(index_code, trade_date DESC);
