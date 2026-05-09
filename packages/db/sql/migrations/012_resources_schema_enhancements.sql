ALTER TABLE startup_resources
  ADD COLUMN IF NOT EXISTS source_external_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS communities TEXT[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_resources_source_external_id
  ON startup_resources (source_external_id)
  WHERE source_external_id IS NOT NULL;
