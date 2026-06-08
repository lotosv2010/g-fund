CREATE TABLE daily_snapshots (
    id                SERIAL PRIMARY KEY,
    snapshot_date     DATE           NOT NULL UNIQUE,
    total_cost        NUMERIC(18,2)  NOT NULL DEFAULT 0,
    total_value       NUMERIC(18,2)  NOT NULL DEFAULT 0,
    total_pnl         NUMERIC(18,2)  NOT NULL DEFAULT 0,
    pnl_ratio         NUMERIC(8,4)   NOT NULL DEFAULT 0,
    position_count    INTEGER        NOT NULL DEFAULT 0,
    positions_snapshot JSONB,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_snapshots_date ON daily_snapshots(snapshot_date DESC);
