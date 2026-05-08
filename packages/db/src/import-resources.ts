import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { dbPool } from "./client.js";

type ResourceCategory =
  | "accelerator"
  | "incubator"
  | "investor"
  | "coworking"
  | "university"
  | "event"
  | "mentor"
  | "government"
  | "service_provider"
  | "community";

type CsvRow = {
  id?: string;
  Title?: string;
  description?: string;
  Communities?: string;
  Industries?: string;
  Locations?: string;
  Topics?: string;
  link?: string;
  email?: string;
};

type LocationMeta = {
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

const UTAH_COUNTY_CENTROIDS: Record<string, LocationMeta> = {
  Beaver: { address: "Beaver County, UT", city: "Beaver", state: "UT", lat: 38.2769, lng: -112.6416 },
  "Box Elder": { address: "Box Elder County, UT", city: "Brigham City", state: "UT", lat: 41.5069, lng: -112.0152 },
  Cache: { address: "Cache County, UT", city: "Logan", state: "UT", lat: 41.7358, lng: -111.8344 },
  Carbon: { address: "Carbon County, UT", city: "Price", state: "UT", lat: 39.5994, lng: -110.8115 },
  Daggett: { address: "Daggett County, UT", city: "Manila", state: "UT", lat: 40.8747, lng: -109.3768 },
  Davis: { address: "Davis County, UT", city: "Farmington", state: "UT", lat: 40.9908, lng: -111.9010 },
  Duchesne: { address: "Duchesne County, UT", city: "Duchesne", state: "UT", lat: 40.1633, lng: -110.4027 },
  Emery: { address: "Emery County, UT", city: "Castle Dale", state: "UT", lat: 39.1303, lng: -111.2149 },
  Garfield: { address: "Garfield County, UT", city: "Panguitch", state: "UT", lat: 37.8596, lng: -111.2436 },
  Grand: { address: "Grand County, UT", city: "Moab", state: "UT", lat: 38.5733, lng: -109.5498 },
  Iron: { address: "Iron County, UT", city: "Parowan", state: "UT", lat: 37.8598, lng: -113.2067 },
  Juab: { address: "Juab County, UT", city: "Nephi", state: "UT", lat: 39.7142, lng: -111.8350 },
  Kane: { address: "Kane County, UT", city: "Kanab", state: "UT", lat: 37.2863, lng: -112.6607 },
  Millard: { address: "Millard County, UT", city: "Fillmore", state: "UT", lat: 39.2035, lng: -113.2153 },
  Morgan: { address: "Morgan County, UT", city: "Morgan", state: "UT", lat: 41.0361, lng: -111.6761 },
  Piute: { address: "Piute County, UT", city: "Junction", state: "UT", lat: 38.3301, lng: -112.2555 },
  Rich: { address: "Rich County, UT", city: "Randolph", state: "UT", lat: 41.7357, lng: -111.1260 },
  "Salt Lake": { address: "Salt Lake County, UT", city: "Salt Lake City", state: "UT", lat: 40.7608, lng: -111.8910 },
  "San Juan": { address: "San Juan County, UT", city: "Monticello", state: "UT", lat: 37.8716, lng: -109.3423 },
  Sanpete: { address: "Sanpete County, UT", city: "Manti", state: "UT", lat: 39.2706, lng: -111.6328 },
  Sevier: { address: "Sevier County, UT", city: "Richfield", state: "UT", lat: 38.7824, lng: -111.5863 },
  Summit: { address: "Summit County, UT", city: "Coalville", state: "UT", lat: 40.9872, lng: -111.3248 },
  Tooele: { address: "Tooele County, UT", city: "Tooele", state: "UT", lat: 40.5308, lng: -112.2983 },
  Uintah: { address: "Uintah County, UT", city: "Vernal", state: "UT", lat: 40.4555, lng: -109.5287 },
  Utah: { address: "Utah County, UT", city: "Provo", state: "UT", lat: 40.2338, lng: -111.6585 },
  Wasatch: { address: "Wasatch County, UT", city: "Heber City", state: "UT", lat: 40.5069, lng: -111.4132 },
  Washington: { address: "Washington County, UT", city: "St. George", state: "UT", lat: 37.0965, lng: -113.5684 },
  Wayne: { address: "Wayne County, UT", city: "Loa", state: "UT", lat: 38.3413, lng: -111.6108 },
  Weber: { address: "Weber County, UT", city: "Ogden", state: "UT", lat: 41.2230, lng: -111.9738 }
};

function getArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function normalizeList(input: string | undefined): string[] {
  if (!input) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function inferCategory(title: string, topics: string[]): ResourceCategory {
  const lowerTitle = title.toLowerCase();
  const lowerTopics = topics.map((topic) => topic.toLowerCase());

  if (lowerTitle.startsWith("event:") || lowerTitle.includes(" summit") || lowerTitle.includes(" conference")) {
    return "event";
  }

  if (
    lowerTitle.includes("venture") ||
    lowerTitle.includes("angel") ||
    lowerTitle.includes("fund") ||
    lowerTopics.includes("funding")
  ) {
    return "investor";
  }

  if (lowerTitle.includes("accelerator")) {
    return "accelerator";
  }

  if (lowerTitle.includes("incubator")) {
    return "incubator";
  }

  if (lowerTitle.includes("cowork") || lowerTitle.includes("workspace") || lowerTitle.includes("makerspace")) {
    return "coworking";
  }

  if (
    lowerTitle.includes("university") ||
    lowerTitle.includes("college") ||
    lowerTitle.includes("school") ||
    lowerTitle.includes("usu") ||
    lowerTitle.includes("byu") ||
    lowerTitle.includes("uvu")
  ) {
    return "university";
  }

  if (
    lowerTitle.includes("department") ||
    lowerTitle.includes("office") ||
    lowerTitle.includes("county") ||
    lowerTitle.includes("city") ||
    lowerTitle.includes("governor") ||
    lowerTitle.includes("federal") ||
    lowerTitle.includes("administration")
  ) {
    return "government";
  }

  if (lowerTitle.includes("consult") || lowerTitle.includes("training") || lowerTitle.includes("resource center")) {
    return "service_provider";
  }

  return "community";
}

function inferStageFit(topics: string[]): string[] {
  const topicSet = new Set(topics.map((topic) => topic.toLowerCase()));
  const stageFit = new Set<string>();

  if (topicSet.has("start a business")) {
    stageFit.add("idea");
    stageFit.add("validation");
  }

  if (topicSet.has("funding")) {
    stageFit.add("fundraising");
  }

  if (topicSet.has("late stage growth")) {
    stageFit.add("traction");
    stageFit.add("scale");
  }

  if (topicSet.has("close or exit a business")) {
    stageFit.add("traction");
    stageFit.add("scale");
  }

  if (stageFit.size === 0) {
    stageFit.add("validation");
    stageFit.add("mvp");
  }

  return Array.from(stageFit);
}

function resolveLocationMeta(locationName: string): LocationMeta {
  const meta = UTAH_COUNTY_CENTROIDS[locationName];

  if (!meta) {
    throw new Error(
      `Unknown location '${locationName}'. Add it to UTAH_COUNTY_CENTROIDS in packages/db/src/import-resources.ts.`
    );
  }

  return meta;
}

async function run() {
  const fileArg = getArg("--file");

  if (!fileArg) {
    throw new Error("Usage: pnpm --filter @founder-gps/db import:resources --file /absolute/path/to/resources.csv");
  }

  const csvPath = path.resolve(fileArg);
  const csvContent = await readFile(csvPath, "utf8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true
  }) as CsvRow[];

  let imported = 0;
  await dbPool.query("BEGIN");

  try {
    for (const row of records) {
      const title = row.Title?.trim();
      if (!title) {
        continue;
      }

      const description = row.description?.trim() || "No description provided.";
      const topics = normalizeList(row.Topics);
      const communities = normalizeList(row.Communities);
      const industries = normalizeList(row.Industries);
      const locations = normalizeList(row.Locations);

      if (locations.length === 0) {
        throw new Error(`Resource '${title}' has no locations in CSV.`);
      }

      const primaryLocation = resolveLocationMeta(locations[0]);
      const website = row.link?.trim() || null;
      const category = inferCategory(title, topics);
      const stageFit = inferStageFit(topics);
      const tags = Array.from(new Set([...topics, ...communities].map(normalizeTag).filter(Boolean)));
      const industryFit = industries.map((industry) => industry.trim().toLowerCase());

      const upsertResult = await dbPool.query<{ id: string }>(
        `
          INSERT INTO startup_resources (
            name,
            category,
            description,
            website,
            address,
            city,
            state,
            lat,
            lng,
            location,
            stage_fit,
            industry_fit,
            tags
          )
          VALUES (
            $1,
            $2::resource_category,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            ST_SetSRID(ST_MakePoint($9, $8), 4326),
            $10::text[],
            $11::text[],
            $12::text[]
          )
          ON CONFLICT (name) DO UPDATE
          SET
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            website = EXCLUDED.website,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            location = EXCLUDED.location,
            stage_fit = EXCLUDED.stage_fit,
            industry_fit = EXCLUDED.industry_fit,
            tags = EXCLUDED.tags,
            updated_at = NOW()
          RETURNING id
        `,
        [
          title,
          category,
          description,
          website,
          primaryLocation.address,
          primaryLocation.city,
          primaryLocation.state,
          primaryLocation.lat,
          primaryLocation.lng,
          stageFit,
          industryFit,
          tags
        ]
      );

      const resourceId = upsertResult.rows[0]?.id;
      if (!resourceId) {
        throw new Error(`Failed to upsert resource '${title}'.`);
      }

      await dbPool.query("DELETE FROM startup_resource_locations WHERE resource_id = $1", [resourceId]);

      for (let index = 0; index < locations.length; index += 1) {
        const locationName = locations[index];
        const meta = resolveLocationMeta(locationName);

        await dbPool.query(
          `
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
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              ST_SetSRID(ST_MakePoint($7, $6), 4326),
              $8
            )
          `,
          [resourceId, locationName, meta.address, meta.city, meta.state, meta.lat, meta.lng, index === 0]
        );
      }

      imported += 1;
    }

    await dbPool.query("COMMIT");
    console.log(`Imported ${imported} resources from ${csvPath}`);
  } catch (error) {
    await dbPool.query("ROLLBACK");
    throw error;
  } finally {
    await dbPool.end();
  }
}

run().catch(async (error) => {
  console.error(error);
  await dbPool.end();
  process.exit(1);
});
