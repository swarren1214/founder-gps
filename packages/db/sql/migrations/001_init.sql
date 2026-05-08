CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'resource_category' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE resource_category AS ENUM (
      'accelerator',
      'incubator',
      'investor',
      'coworking',
      'university',
      'event',
      'mentor',
      'government',
      'service_provider',
      'community'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS founder_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT,
  location_city TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  startup_idea TEXT NOT NULL,
  industry TEXT,
  stage TEXT NOT NULL,
  biggest_challenge TEXT NOT NULL,
  funding_status TEXT,
  founder_background TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS startup_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category resource_category NOT NULL,
  description TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  stage_fit TEXT[] NOT NULL DEFAULT '{}',
  industry_fit TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_startup_resources_category ON startup_resources (category);
CREATE INDEX IF NOT EXISTS idx_startup_resources_city ON startup_resources (city);
CREATE INDEX IF NOT EXISTS idx_startup_resources_stage_fit ON startup_resources USING GIN (stage_fit);
CREATE INDEX IF NOT EXISTS idx_startup_resources_industry_fit ON startup_resources USING GIN (industry_fit);
CREATE INDEX IF NOT EXISTS idx_startup_resources_location ON startup_resources USING GIST (location);
CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_resources_name ON startup_resources (name);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_profile_id UUID NOT NULL REFERENCES founder_profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES startup_resources(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  reason TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_profile_id UUID NOT NULL REFERENCES founder_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  goal TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  related_resource_id UUID REFERENCES startup_resources(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS founder_analysis_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_profile_id UUID REFERENCES founder_profiles(id) ON DELETE SET NULL,
  analysis_json JSONB NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founder_analysis_snapshots_founder_profile_id
  ON founder_analysis_snapshots (founder_profile_id);
