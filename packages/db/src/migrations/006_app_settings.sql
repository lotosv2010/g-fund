CREATE TABLE IF NOT EXISTS app_settings (
  key   VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES ('target_total_position', '0')
  ON CONFLICT (key) DO NOTHING;
