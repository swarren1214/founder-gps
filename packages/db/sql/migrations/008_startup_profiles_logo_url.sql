ALTER TABLE startup_profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_startup_profiles_logo_url
  ON startup_profiles (logo_url);
