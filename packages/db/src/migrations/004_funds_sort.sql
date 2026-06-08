ALTER TABLE funds ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_funds_sort_order ON funds(sort_order);
