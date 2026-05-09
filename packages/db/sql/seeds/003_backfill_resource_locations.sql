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
  COALESCE(NULLIF(sr.city, ''), 'Unknown') AS location_name,
  COALESCE(NULLIF(sr.address, ''), CONCAT(sr.city, ', ', sr.state)) AS address,
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
)
AND sr.city IS NOT NULL
AND sr.state IS NOT NULL
AND sr.lat IS NOT NULL
AND sr.lng IS NOT NULL
AND sr.location IS NOT NULL;
