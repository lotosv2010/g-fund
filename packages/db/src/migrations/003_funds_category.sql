ALTER TABLE funds ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'holding';
CREATE INDEX IF NOT EXISTS idx_funds_category ON funds(category);
