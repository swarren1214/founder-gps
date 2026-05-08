import { Pool, type QueryResultRow } from "pg";
import type {
  ResourceCategory,
  ResourceFeatureCollection,
  StartupProfile,
  StartupResource
} from "@founder-gps/shared-types";
import type { ResourceFilters, StartupFilters } from "./types.js";

export interface ResourceRepository {
  list(filters: ResourceFilters): Promise<StartupResource[]>;
  startups(filters: StartupFilters): Promise<StartupProfile[]>;
  getById(id: string): Promise<StartupResource | null>;
  mapData(filters: ResourceFilters): Promise<ResourceFeatureCollection>;
  categories(): Promise<ResourceCategory[]>;
}

function toResource(row: QueryResultRow): StartupResource {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    website: row.website,
    logoUrl: row.logo_url,
    address: row.address,
    city: row.city,
    state: row.state,
    lat: Number(row.lat),
    lng: Number(row.lng),
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
    params.push(filters.city);
    where.push(`city ILIKE $${params.length}`);
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
    where.push(`(name ILIKE $${idx} OR description ILIKE $${idx} OR array_to_string(tags, ' ') ILIKE $${idx})`);
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
      `ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)::geography, $${radiusIdx})`
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
      SELECT
        id, name, category, description, website, logo_url, address,
        city, state, lat, lng, stage_fit, industry_fit, tags,
        created_at, updated_at
      FROM startup_resources
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
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
        lat, lng, created_at, updated_at
      FROM startup_profiles
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      params
    );

    return result.rows.map(toStartupProfile);
  }

  async getById(id: string): Promise<StartupResource | null> {
    const result = await this.pool.query(
      `
      SELECT
        id, name, category, description, website, logo_url, address,
        city, state, lat, lng, stage_fit, industry_fit, tags,
        created_at, updated_at
      FROM startup_resources
      WHERE id = $1
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
