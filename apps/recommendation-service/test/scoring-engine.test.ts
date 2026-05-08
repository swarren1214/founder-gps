import { describe, expect, it } from "vitest";
import { rankRecommendations } from "../src/engine/scoring.js";
import type { FounderAnalysis, FounderProfileInput, StartupResource } from "../src/types.js";

const founderProfile: FounderProfileInput = {
  founderProfileId: "2f8eb6f4-d6b8-4f87-bf42-437d5cb8dc03",
  location: {
    city: "Lehi",
    lat: 40.3916,
    lng: -111.8508
  },
  idea: "AI workflow assistant",
  industry: "saas",
  stage: "validation",
  challenge: "stuck on distribution",
  background: "product operator"
};

const founderAnalysis: FounderAnalysis = {
  stage: "validation",
  primaryNeeds: ["customer_discovery", "distribution_strategy"],
  secondaryNeeds: ["mentor_network"],
  industry: "saas",
  founderType: "operator",
  confidenceScore: 0.87,
  suggestedFocus: "Run discovery and tighten ICP.",
  risks: ["building too early"]
};

const resources: StartupResource[] = [
  {
    id: "293bf86b-018e-4f30-80cd-08d0ca6422bb",
    name: "Silicon Slopes",
    category: "community",
    description: "Founder network",
    website: "https://siliconslopes.com",
    logoUrl: null,
    address: null,
    city: "Lehi",
    state: "UT",
    lat: 40.3916,
    lng: -111.8508,
    stageFit: ["idea", "validation", "mvp"],
    industryFit: ["saas", "ai"],
    tags: ["community", "mentor_network", "distribution_strategy"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "ec8f0d39-1b5d-48f9-a538-4e1cb695f497",
    name: "Pelion Venture Partners",
    category: "investor",
    description: "VC",
    website: "https://pelionvp.com",
    logoUrl: null,
    address: null,
    city: "Salt Lake City",
    state: "UT",
    lat: 40.7594,
    lng: -111.8935,
    stageFit: ["fundraising", "scale"],
    industryFit: ["enterprise", "security"],
    tags: ["vc"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

describe("recommendation scoring engine", () => {
  it("ranks better stage and need fit higher", () => {
    const ranked = rankRecommendations(founderProfile, founderAnalysis, resources);

    expect(ranked).toHaveLength(2);
    expect(ranked[0].resourceName).toBe("Silicon Slopes");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("returns stable ranking for fixed inputs", () => {
    const firstRun = rankRecommendations(founderProfile, founderAnalysis, resources).map((r) => ({
      resourceId: r.resourceId,
      score: r.score
    }));

    const secondRun = rankRecommendations(founderProfile, founderAnalysis, resources).map((r) => ({
      resourceId: r.resourceId,
      score: r.score
    }));

    expect(firstRun).toEqual(secondRun);
  });
});
