import { describe, expect, it } from "vitest";
import type { MapFilters, ResourceCardData, StartupProfileData } from "@/lib/schemas";
import { filterResources, filterStartups } from "@/lib/map-filters";

const resources: ResourceCardData[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Utah Investor Group",
    category: "investor",
    description: "Early stage funding support in Utah",
    sourceExternalId: null,
    website: null,
    logoUrl: null,
    contactEmail: null,
    communities: [],
    address: "123 Main St",
    city: "Provo",
    state: "UT",
    lat: 40,
    lng: -111,
    locations: [],
    stageFit: ["mvp", "launched"],
    industryFit: ["software"],
    tags: ["funding"],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Colorado Mentor Hub",
    category: "coworking",
    description: "Mentorship and space",
    sourceExternalId: null,
    website: null,
    logoUrl: null,
    contactEmail: null,
    communities: [],
    address: "45 Market St",
    city: "Denver",
    state: "CO",
    lat: 39,
    lng: -104,
    locations: [],
    stageFit: ["validation"],
    industryFit: ["general"],
    tags: ["mentor"],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  }
];

const startups: StartupProfileData[] = [
  {
    id: "00000000-0000-0000-0000-000000000010",
    name: "ScaleAI",
    website: null,
    logoUrl: null,
    employees: "51-200",
    sector: "B2B Software",
    yearFounded: 2020,
    linkedin: null,
    description: "Series A SaaS workflow startup",
    address: "Lehi, UT",
    hiringStatus: null,
    jobPostings: [],
    photoGallery: [],
    lat: null,
    lng: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  },
  {
    id: "00000000-0000-0000-0000-000000000011",
    name: "TinyHealth",
    website: null,
    logoUrl: null,
    employees: "2-10",
    sector: "Health",
    yearFounded: 2023,
    linkedin: null,
    description: "Bootstrapped health startup",
    address: "Salt Lake City, UT",
    hiringStatus: null,
    jobPostings: [],
    photoGallery: [],
    lat: null,
    lng: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  }
];

describe("map filters", () => {
  it("filters resources by state", () => {
    const filters: MapFilters = { intent: "filter_resources", states: ["UT"] };
    const filtered = filterResources(resources, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Utah Investor Group");
  });

  it("supports compound startup filters for state, employee range, and stage keywords", () => {
    const filters: MapFilters = {
      intent: "filter_startups",
      states: ["UT"],
      employeeMin: 51,
      startupStageKeywords: ["series a"]
    };

    const filtered = filterStartups(startups, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("ScaleAI");
  });
});
