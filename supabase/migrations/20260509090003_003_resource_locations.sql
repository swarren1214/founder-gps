CREATE TABLE IF NOT EXISTS startup_resource_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES startup_resources(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_startup_resource_locations_resource_location UNIQUE (resource_id, location_name)
);

CREATE INDEX IF NOT EXISTS idx_startup_resource_locations_resource_id
  ON startup_resource_locations (resource_id);

CREATE INDEX IF NOT EXISTS idx_startup_resource_locations_city
  ON startup_resource_locations (city);

CREATE INDEX IF NOT EXISTS idx_startup_resource_locations_location
  ON startup_resource_locations USING GIST (location);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_resource_locations_primary
  ON startup_resource_locations (resource_id)
  WHERE is_primary = TRUE;

INSERT INTO startup_resource_locations (
  resource_id,
  location_name,
  address,
  city,
  state,
  lat,
  lng,
  location,
  is_primary
)
SELECT
  sr.id,
  sr.city,
  COALESCE(sr.address, CONCAT(sr.city, ', ', sr.state)),
  sr.city,
  sr.state,
  sr.lat,
  sr.lng,
  sr.location,
  TRUE
FROM startup_resources sr
WHERE NOT EXISTS (
  SELECT 1
  FROM startup_resource_locations srl
  WHERE srl.resource_id = sr.id
);
