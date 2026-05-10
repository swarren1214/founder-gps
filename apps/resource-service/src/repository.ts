import { Pool, type QueryResultRow } from "pg";
import type {
  ResourceLocation,
  ResourceCategory,
  ResourceFeatureCollection,
  StartupProfile,
  StartupResource,
  CreateStartupProfileInput
} from "../../../packages/shared-types/dist/index.js";
import type { ResourceFilters, StartupFilters } from "./types.js";

export interface ResourceRepository {
  list(filters: ResourceFilters): Promise<StartupResource[]>;
  startups(filters: StartupFilters): Promise<StartupProfile[]>;
  createStartup(input: CreateStartupProfileInput): Promise<StartupProfile>;
  getById(id: string): Promise<StartupResource | null>;
  mapData(filters: ResourceFilters): Promise<ResourceFeatureCollection>;
  categories(): Promise<ResourceCategory[]>;
}

function toResource(row: QueryResultRow): StartupResource {
  const rawLocations = Array.isArray(row.locations) ? row.locations : [];
  const locations: ResourceLocation[] = rawLocations.map((location) => ({
    id: location.id,
    locationName: location.locationName,
    address: location.address,
    city: location.city,
    state: location.state,
    lat: Number(location.lat),
    lng: Number(location.lng),
    isPrimary: Boolean(location.isPrimary)
  }));

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    sourceExternalId: row.source_external_id,
    website: row.website,
    logoUrl: row.logo_url,
    contactEmail: row.contact_email,
    communities: Array.isArray(row.communities) ? row.communities : [],
    address: row.address,
    city: row.city,
    state: row.state,
    lat: Number(row.lat),
    lng: Number(row.lng),
    locations,
    stageFit: row.stage_fit,
    industryFit: row.industry_fit,
    tags: row.tags,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toStartupProfile(row: QueryResultRow): StartupProfile {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    logoUrl: row.logo_url,
    employees: row.employees,
    sector: row.sector,
    yearFounded: row.year_founded,
    linkedin: row.linkedin,
    description: row.description,
    address: row.address,
    hiringStatus: row.hiring_status,
    jobPostings: Array.isArray(row.job_postings) ? row.job_postings : [],
    photoGallery: Array.isArray(row.photo_gallery) ? row.photo_gallery : [],
    lat: typeof row.lat === "number" ? row.lat : row.lat === null ? null : Number(row.lat),
    lng: typeof row.lng === "number" ? row.lng : row.lng === null ? null : Number(row.lng),
    stage: row.stage ?? null,
    dateFounded: row.date_founded ? (row.date_founded instanceof Date ? row.date_founded.toISOString().slice(0, 10) : String(row.date_founded)) : null,
    phone: row.phone ?? null,
    onboardingContext: row.onboarding_context ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function buildFilters(filters: ResourceFilters, params: unknown[]): string[] {
  const where: string[] = [];

  if (filters.category) {
    params.push(filters.category);
    where.push(`category = $${params.length}::resource_category`);
  }

  if (filters.city) {
    params.push(`%${filters.city}%`);
    const idx = params.length;
    where.push(`EXISTS (
      SELECT 1
      FROM startup_resource_locations srl
      WHERE srl.resource_id = sr.id
        AND (srl.city ILIKE $${idx} OR srl.location_name ILIKE $${idx} OR srl.address ILIKE $${idx})
    )`);
  }

  if (filters.stage) {
    params.push(filters.stage);
    where.push(`$${params.length} = ANY(stage_fit)`);
  }

  if (filters.industry) {
    params.push(filters.industry);
    where.push(`$${params.length} = ANY(industry_fit)`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const idx = params.length;
    where.push(`(
      sr.name ILIKE $${idx}
      OR sr.description ILIKE $${idx}
      OR array_to_string(sr.tags, ' ') ILIKE $${idx}
      OR array_to_string(sr.communities, ' ') ILIKE $${idx}
      OR EXISTS (
        SELECT 1
        FROM startup_resource_locations srl
        WHERE srl.resource_id = sr.id
          AND (srl.city ILIKE $${idx} OR srl.location_name ILIKE $${idx} OR srl.address ILIKE $${idx})
      )
    )`);
  }

  if (
    typeof filters.lat === "number" &&
    typeof filters.lng === "number" &&
    typeof filters.radiusMiles === "number"
  ) {
    params.push(filters.lng);
    const lngIdx = params.length;
    params.push(filters.lat);
    const latIdx = params.length;
    params.push(filters.radiusMiles * 1609.34);
    const radiusIdx = params.length;
    where.push(
      `EXISTS (
        SELECT 1
        FROM startup_resource_locations srl
        WHERE srl.resource_id = sr.id
          AND ST_DWithin(
            srl.location::geography,
            ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)::geography,
            $${radiusIdx}
          )
      )`
    );
  }

  return where;
}

export class PgResourceRepository implements ResourceRepository {
  constructor(private readonly pool: Pool) {}

  async list(filters: ResourceFilters): Promise<StartupResource[]> {
    const params: unknown[] = [];
    const where = buildFilters(filters, params);

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      WITH filtered_resources AS (
        SELECT sr.id
        FROM startup_resources sr
        ${whereClause}
        ORDER BY sr.name ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      )
      SELECT
        sr.id,
        sr.name,
        sr.category,
        sr.description,
        sr.source_external_id,
        sr.website,
        sr.logo_url,
        sr.contact_email,
        sr.communities,
        COALESCE(primary_location.address, sr.address) AS address,
        COALESCE(primary_location.city, sr.city) AS city,
        COALESCE(primary_location.state, sr.state) AS state,
        COALESCE(primary_location.lat, sr.lat) AS lat,
        COALESCE(primary_location.lng, sr.lng) AS lng,
        location_agg.locations,
        sr.stage_fit,
        sr.industry_fit,
        sr.tags,
        sr.created_at,
        sr.updated_at
      FROM filtered_resources fr
      JOIN startup_resources sr ON sr.id = fr.id
      LEFT JOIN LATERAL (
        SELECT srl.address, srl.city, srl.state, srl.lat, srl.lng
        FROM startup_resource_locations srl
        WHERE srl.resource_id = sr.id AND srl.is_primary = TRUE
        LIMIT 1
      ) AS primary_location ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'id', srl.id,
              'locationName', srl.location_name,
              'address', srl.address,
              'city', srl.city,
              'state', srl.state,
              'lat', srl.lat,
              'lng', srl.lng,
              'isPrimary', srl.is_primary
            )
            ORDER BY srl.is_primary DESC, srl.location_name ASC
          ),
          '[]'::json
        ) AS locations
        FROM startup_resource_locations srl
        WHERE srl.resource_id = sr.id
      ) AS location_agg ON TRUE
      ORDER BY name ASC
    `;

    const result = await this.pool.query(query, params);
    return result.rows.map(toResource);
  }

  async startups(filters: StartupFilters): Promise<StartupProfile[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.city) {
      params.push(`%${filters.city}%`);
      const idx = params.length;
      where.push(`address ILIKE $${idx}`);
    }

    if (filters.q) {
      params.push(`%${filters.q}%`);
      const idx = params.length;
      where.push(`(name ILIKE $${idx} OR COALESCE(description, '') ILIKE $${idx} OR COALESCE(sector, '') ILIKE $${idx})`);
    }

    const limit = filters.limit ?? 500;
    const offset = filters.offset ?? 0;
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const result = await this.pool.query(
      `
      SELECT
        id, name, website, logo_url, employees, sector, year_founded, linkedin,
        description, address, hiring_status, job_postings, photo_gallery,
        lat, lng, stage, date_founded, phone, onboarding_context,
        created_at, updated_at
      FROM startup_profiles
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      params
    );

    return result.rows.map(toStartupProfile);
  }

  async createStartup(input: CreateStartupProfileInput): Promise<StartupProfile> {
    const yearFounded = input.yearFounded
      ?? (input.dateFounded ? new Date(input.dateFounded).getFullYear() : null);

    const result = await this.pool.query(
      `
      INSERT INTO startup_profiles
        (name, website, employees, sector, year_founded, description, address,
         stage, date_founded, phone, onboarding_context)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8,
         $9::date, $10,
         $11::jsonb)
      ON CONFLICT (name, website) DO UPDATE SET
        employees     = EXCLUDED.employees,
        sector        = EXCLUDED.sector,
        year_founded  = EXCLUDED.year_founded,
        description   = EXCLUDED.description,
        address       = EXCLUDED.address,
        stage         = EXCLUDED.stage,
        date_founded  = EXCLUDED.date_founded,
        phone         = EXCLUDED.phone,
        onboarding_context = EXCLUDED.onboarding_context,
        updated_at    = NOW()
      RETURNING
        id, name, website, logo_url, employees, sector, year_founded, linkedin,
        description, address, hiring_status, job_postings, photo_gallery,
        lat, lng, stage, date_founded, phone, onboarding_context,
        created_at, updated_at
      `,
      [
        input.name,
        input.website ?? null,
        input.employees ?? null,
        input.sector ?? null,
        yearFounded,
        input.description ?? null,
        input.address ?? null,
        input.stage ?? null,
        input.dateFounded ?? null,
        input.phone ?? null,
        JSON.stringify(input.onboardingContext ?? {})
      ]
    );

    return toStartupProfile(result.rows[0]);
  }

  async getById(id: string): Promise<StartupResource | null> {
    const result = await this.pool.query(
      `
      SELECT
        sr.id,
        sr.name,
        sr.category,
        sr.description,
        sr.source_external_id,
        sr.website,
        sr.logo_url,
        sr.contact_email,
        sr.communities,
        COALESCE(primary_location.address, sr.address) AS address,
        COALESCE(primary_location.city, sr.city) AS city,
        COALESCE(primary_location.state, sr.state) AS state,
        COALESCE(primary_location.lat, sr.lat) AS lat,
        COALESCE(primary_location.lng, sr.lng) AS lng,
        location_agg.locations,
        sr.stage_fit,
        sr.industry_fit,
        sr.tags,
        sr.created_at,
        sr.updated_at
      FROM startup_resources sr
      LEFT JOIN LATERAL (
        SELECT srl.address, srl.city, srl.state, srl.lat, srl.lng
        FROM startup_resource_locations srl
        WHERE srl.resource_id = sr.id AND srl.is_primary = TRUE
        LIMIT 1
      ) AS primary_location ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'id', srl.id,
              'locationName', srl.location_name,
              'address', srl.address,
              'city', srl.city,
              'state', srl.state,
              'lat', srl.lat,
              'lng', srl.lng,
              'isPrimary', srl.is_primary
            )
            ORDER BY srl.is_primary DESC, srl.location_name ASC
          ),
          '[]'::json
        ) AS locations
        FROM startup_resource_locations srl
        WHERE srl.resource_id = sr.id
      ) AS location_agg ON TRUE
      WHERE sr.id = $1
    `,
      [id]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return toResource(result.rows[0]);
  }

  async mapData(filters: ResourceFilters): Promise<ResourceFeatureCollection> {
    const resources = await this.list({ ...filters, limit: filters.limit ?? 500, offset: 0 });

    return {
      type: "FeatureCollection",
      features: resources.map((resource) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [resource.lng, resource.lat]
        },
        properties: {
          id: resource.id,
          name: resource.name,
          category: resource.category,
          logoUrl: resource.logoUrl ?? undefined
        }
      }))
    };
  }

  async categories(): Promise<ResourceCategory[]> {
    const result = await this.pool.query(
      "SELECT DISTINCT category FROM startup_resources ORDER BY category ASC"
    );

    return result.rows.map((row: { category: string }) => row.category as ResourceCategory);
  }
}
