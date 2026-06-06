-- 持仓快照表
CREATE TABLE positions (
    id          SERIAL PRIMARY KEY,
    fund_code   VARCHAR(20)    NOT NULL UNIQUE,
    fund_name   VARCHAR(100)   NOT NULL,
    shares      NUMERIC(18,4)  NOT NULL DEFAULT 0,
    cost_price  NUMERIC(10,4)  NOT NULL,
    cost_amount NUMERIC(18,2)  NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 交易流水表
CREATE TABLE transactions (
    id          SERIAL PRIMARY KEY,
    fund_code   VARCHAR(20)    NOT NULL,
    fund_name   VARCHAR(100)   NOT NULL,
    type        VARCHAR(4)     NOT NULL CHECK (type IN ('buy', 'sell')),
    amount      NUMERIC(18,2)  NOT NULL,
    shares      NUMERIC(18,4),
    price       NUMERIC(10,4),
    trade_date  DATE           NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 每日操作日志（一天一条）
CREATE TABLE daily_logs (
    id          SERIAL PRIMARY KEY,
    log_date    DATE           NOT NULL UNIQUE,
    summary     TEXT,
    market_note TEXT,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- AI 分析记录
CREATE TABLE analysis_records (
    id             SERIAL PRIMARY KEY,
    provider       VARCHAR(20)  NOT NULL,
    input_snapshot JSONB        NOT NULL,
    result         JSONB        NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_transactions_fund_code ON transactions(fund_code);
CREATE INDEX idx_transactions_trade_date ON transactions(trade_date DESC);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date DESC);
CREATE INDEX idx_analysis_created ON analysis_records(created_at DESC);
