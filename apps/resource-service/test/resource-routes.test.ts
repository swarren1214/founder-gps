import { describe, expect, it } from "vitest";
import type {
  ResourceCategory,
  ResourceFeatureCollection,
  StartupProfile,
  StartupResource
} from "@founder-gps/shared-types";
import { buildApp } from "../src/app.js";
import type { ResourceRepository } from "../src/repository.js";

const fixtureResources: StartupResource[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Silicon Slopes",
    category: "community",
    description: "Founder community",
    website: "https://siliconslopes.com",
    logoUrl: null,
    address: null,
    city: "Lehi",
    state: "UT",
    lat: 40.3916,
    lng: -111.8508,
    stageFit: ["idea", "validation"],
    industryFit: ["saas"],
    tags: ["community"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Kickstart Fund",
    category: "investor",
    description: "Early-stage VC",
    website: "https://kickstartfund.com",
    logoUrl: null,
    address: null,
    city: "Cottonwood Heights",
    state: "UT",
    lat: 40.6197,
    lng: -111.8102,
    stageFit: ["mvp", "fundraising"],
    industryFit: ["saas", "ai"],
    tags: ["vc"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

class InMemoryResourceRepository implements ResourceRepository {
  async list(filters: Record<string, unknown>) {
    let rows = [...fixtureResources];

    if (typeof filters.category === "string") {
      rows = rows.filter((r) => r.category === filters.category);
    }

    return rows;
  }

  async getById(id: string) {
    return fixtureResources.find((r) => r.id === id) ?? null;
  }

  async startups(): Promise<StartupProfile[]> {
    return [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Demo Startup",
        website: "https://demo-startup.com",
        logoUrl: "https://cdn.example.com/demo-logo.png",
        employees: "11-50",
        sector: "B2B Software",
        yearFounded: null,
        linkedin: null,
        description: "Demo startup profile",
        address: "Lehi, UT",
        hiringStatus: null,
        jobPostings: [],
        photoGallery: [],
        lat: 40.3916,
        lng: -111.8508,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  async mapData(): Promise<ResourceFeatureCollection> {
    return {
      type: "FeatureCollection",
      features: fixtureResources.map((r) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [r.lng, r.lat]
        },
        properties: {
          id: r.id,
          name: r.name,
          category: r.category
        }
      }))
    };
  }

  async categories(): Promise<ResourceCategory[]> {
    return ["community", "investor"];
  }
}

describe("resource routes", () => {
  const app = buildApp({ repository: new InMemoryResourceRepository() });

  it("filters resources by category", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/resources?category=community"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBe(1);
    expect(body.resources[0].name).toBe("Silicon Slopes");
  });

  it("validates POST /resources/search payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/resources/search",
      payload: {
        category: "not-a-real-category"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns GeoJSON map data", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/resources/map-data"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.type).toBe("FeatureCollection");
    expect(body.features.length).toBe(2);
  });

  it("returns startup profiles", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/startups"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBe(1);
    expect(body.startups[0].name).toBe("Demo Startup");
  });
});
