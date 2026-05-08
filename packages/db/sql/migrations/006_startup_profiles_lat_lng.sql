ALTER TABLE startup_profiles
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

ALTER TABLE startup_profiles
  DROP CONSTRAINT IF EXISTS startup_profiles_lat_range_check,
  DROP CONSTRAINT IF EXISTS startup_profiles_lng_range_check;

ALTER TABLE startup_profiles
  ADD CONSTRAINT startup_profiles_lat_range_check CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  ADD CONSTRAINT startup_profiles_lng_range_check CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));

WITH city_coords(city, lat, lng) AS (
  VALUES
    ('American Fork', 40.3769, -111.7958),
    ('Bluffdale', 40.4897, -111.9388),
    ('Cottonwood Heights', 40.6197, -111.8102),
    ('Draper', 40.5247, -111.8638),
    ('Fruit Heights', 41.0144, -111.9072),
    ('Heber City', 40.5069, -111.4132),
    ('Herriman', 40.5141, -112.0325),
    ('Highland', 40.4269, -111.7852),
    ('Holladay', 40.6688, -111.8247),
    ('Kaysville', 41.0352, -111.9386),
    ('Layton', 41.0602, -111.9711),
    ('Lehi', 40.3916, -111.8508),
    ('Lindon', 40.3433, -111.7208),
    ('Logan', 41.7355, -111.8344),
    ('Midvale', 40.6111, -111.8999),
    ('Murray', 40.6669, -111.8879),
    ('Orem', 40.2969, -111.6946),
    ('Park City', 40.6461, -111.4980),
    ('Pleasant Grove', 40.3641, -111.7385),
    ('Provo', 40.2338, -111.6585),
    ('Salt Lake City', 40.7608, -111.8910),
    ('Sandy', 40.5649, -111.8389),
    ('Saratoga Springs', 40.3492, -111.9047),
    ('South Jordan', 40.5622, -111.9297),
    ('St. George', 37.0965, -113.5684),
    ('Saint George', 37.0965, -113.5684),
    ('West Jordan', 40.6097, -111.9391),
    ('West Valley City', 40.6916, -112.0011),
    ('Alpine', 40.4533, -111.7777)
), matched AS (
  SELECT
    sp.id,
    cc.lat,
    cc.lng,
    ROW_NUMBER() OVER (PARTITION BY sp.id ORDER BY LENGTH(cc.city) DESC) AS match_rank
  FROM startup_profiles sp
  JOIN city_coords cc
    ON sp.address ILIKE '%' || cc.city || '%'
  WHERE sp.address IS NOT NULL
)
UPDATE startup_profiles sp
SET
  lat = m.lat,
  lng = m.lng,
  updated_at = NOW()
FROM matched m
WHERE sp.id = m.id
  AND m.match_rank = 1
  AND (sp.lat IS NULL OR sp.lng IS NULL);

CREATE INDEX IF NOT EXISTS idx_startup_profiles_lat_lng
  ON startup_profiles (lat, lng);
