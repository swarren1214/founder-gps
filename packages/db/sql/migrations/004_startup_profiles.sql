CREATE TABLE IF NOT EXISTS startup_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  employees INTEGER CHECK (employees IS NULL OR employees >= 0),
  sector TEXT,
  year_founded INTEGER CHECK (
    year_founded IS NULL OR (year_founded >= 1800 AND year_founded <= EXTRACT(YEAR FROM NOW())::INTEGER + 1)
  ),
  linkedin TEXT,
  description TEXT,
  address TEXT,
  hiring_status TEXT,
  job_postings JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_profiles_name_website
  ON startup_profiles (name, website);

CREATE INDEX IF NOT EXISTS idx_startup_profiles_sector
  ON startup_profiles (sector);

CREATE INDEX IF NOT EXISTS idx_startup_profiles_hiring_status
  ON startup_profiles (hiring_status);
