CREATE TABLE IF NOT EXISTS funds (
    id            SERIAL PRIMARY KEY,
    code          VARCHAR(20)    NOT NULL UNIQUE,
    name          VARCHAR(100)   NOT NULL,
    type          VARCHAR(20),
    risk_level    SMALLINT,
    cost_amount   NUMERIC(18,2)  NOT NULL DEFAULT 0,
    current_value NUMERIC(18,2)  NOT NULL DEFAULT 0,
    target_amount NUMERIC(18,2)  NOT NULL DEFAULT 0,
    target_ratio  NUMERIC(5,2)   NOT NULL DEFAULT 0,
    note          TEXT,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funds_code ON funds(code);
