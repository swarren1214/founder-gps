-- Add fields to startup_profiles to store founder intake form data

ALTER TABLE startup_profiles
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS date_founded DATE,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN startup_profiles.stage IS 'Funding/growth stage from founder intake form (e.g. pre-revenue, seed, series-a)';
COMMENT ON COLUMN startup_profiles.date_founded IS 'Full date the company was founded (complements year_founded integer)';
COMMENT ON COLUMN startup_profiles.phone IS 'Primary contact phone number for the startup';
COMMENT ON COLUMN startup_profiles.onboarding_context IS 'Full structured intake data including interview turns, form answers, and metadata';
