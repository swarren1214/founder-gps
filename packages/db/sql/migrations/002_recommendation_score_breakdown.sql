ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS score_breakdown JSONB NOT NULL DEFAULT '{"stageMatch":0,"needMatch":0,"industryMatch":0,"proximity":0,"urgency":0}'::jsonb;
