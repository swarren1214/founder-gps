import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { IntelligenceClient } from "../src/clients/intelligence-client.js";
import type { ResourceClient } from "../src/clients/resource-client.js";
import type { RecommendationRepository } from "../src/repository.js";
import type { FounderAnalysis, Recommendation, StartupResource } from "../src/types.js";

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
    name: "Kickstart Fund",
    category: "investor",
    description: "VC",
    website: "https://kickstartfund.com",
    logoUrl: null,
    address: null,
    city: "Cottonwood Heights",
    state: "UT",
    lat: 40.6197,
    lng: -111.8102,
    stageFit: ["mvp", "fundraising"],
    industryFit: ["saas", "ai"],
    tags: ["vc", "fundraising"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

class StubResourceClient implements ResourceClient {
  async fetchResources(): Promise<StartupResource[]> {
    return resources;
  }
}

class StubIntelligenceClient implements IntelligenceClient {
  async analyzeFounder(_payload: {
    location: string;
    idea: string;
    industry?: string;
    stage: "idea" | "validation" | "mvp" | "launched" | "traction" | "fundraising" | "scale";
    challenge: string;
    fundingStatus?: string;
    background: string;
    founderProfileId?: string;
  }): Promise<FounderAnalysis> {
    return {
      stage: "validation",
      primaryNeeds: ["customer_discovery", "distribution_strategy"],
      secondaryNeeds: ["mentor_network"],
      industry: "saas",
      founderType: "operator",
      confidenceScore: 0.85,
      suggestedFocus: "Validate demand before overbuilding.",
      risks: ["building too early"]
    };
  }

  async explainRecommendation(payload: {
    founderSummary: string;
    recommendationName: string;
    recommendationReason: string;
    score: number;
  }): Promise<{ explanation: string; founderAction: string }> {
    return {
      explanation: `${payload.recommendationName} is a strong next step for current needs.`,
      founderAction: `Schedule one meeting with ${payload.recommendationName} this week.`
    };
  }
}

class InMemoryRecommendationRepository implements RecommendationRepository {
  private rows: Recommendation[] = [];

  async saveRecommendations(params: {
    founderProfileId: string;
    recommendations: Recommendation[];
    recompute?: boolean;
  }): Promise<Recommendation[]> {
    if (params.recompute) {
      this.rows = this.rows.filter((r) => r.founderProfileId !== params.founderProfileId);
    }

    this.rows = [...this.rows, ...params.recommendations];
    return params.recommendations;
  }

  async getRecommendationsByFounderProfile(founderProfileId: string): Promise<Recommendation[]> {
    return this.rows.filter((r) => r.founderProfileId === founderProfileId);
  }
}

describe("recommendation routes", () => {
  const app = buildApp({
    resourceClient: new StubResourceClient(),
    intelligenceClient: new StubIntelligenceClient(),
    repository: new InMemoryRecommendationRepository()
  });

  it("generates and persists ranked recommendations end-to-end", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/recommendations/generate",
      payload: {
        founderProfile: {
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
        },
        topN: 2,
        recompute: true,
        filters: {
          limit: 20
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBe(2);
    expect(body.recommendations[0].score).toBeGreaterThanOrEqual(body.recommendations[1].score);
    expect(body.recommendations[0].reason).toContain("strong next step");
  });

  it("validates malformed payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/recommendations/generate",
      payload: {
        founderProfile: {
          founderProfileId: "not-a-uuid"
        }
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("replays persisted recommendations with product-facing fields intact", async () => {
    const founderProfileId = "7d19f7b8-dbc7-42e5-a67b-c90a6974b7b2";

    await app.inject({
      method: "POST",
      url: "/recommendations/generate",
      payload: {
        founderProfile: {
          founderProfileId,
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
        },
        topN: 2,
        recompute: true,
        filters: {
          limit: 20
        }
      }
    });

    const replayResponse = await app.inject({
      method: "GET",
      url: `/recommendations/replay/${founderProfileId}`
    });

    expect(replayResponse.statusCode).toBe(200);
    const body = replayResponse.json();
    expect(body.count).toBe(2);
    expect(body.recommendations[0].resourceName).toBeTruthy();
    expect(body.recommendations[0].reason).toContain("strong next step");
    expect(body.recommendations[0].scoreBreakdown.stageMatch).toBeGreaterThan(0);
  });
});
