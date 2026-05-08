/**
 * End-to-End Tests for Founder GPS MVP
 * Tests the complete flow from founder intake through dashboard display
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * E2E Test Configuration
 */
const BASE_URLS = {
  web: process.env.WEB_URL || "http://localhost:3000",
  intelligence: process.env.INTELLIGENCE_SERVICE_URL || "http://localhost:4003",
  resource: process.env.RESOURCE_SERVICE_URL || "http://localhost:4001",
  recommendation: process.env.RECOMMENDATION_SERVICE_URL || "http://localhost:4004",
  routing: process.env.ROUTING_SERVICE_URL || "http://localhost:4002"
};

/**
 * Sample founder profiles for testing
 */
const testProfiles = {
  saasFounder: {
    founderProfileId: "test-saas-founder-" + Date.now(),
    locationCity: "Lehi",
    locationLat: 40.3916,
    locationLng: -111.8508,
    idea: "AI workflow copilot for service businesses",
    industry: "saas",
    stage: "validation",
    challenge: "Need customer discovery and founder network",
    fundingStatus: "bootstrapped",
    background: "Product operator with field experience"
  },
  deeptech: {
    founderProfileId: "test-deeptech-" + Date.now(),
    locationCity: "Provo",
    locationLat: 40.2338,
    locationLng: -111.6585,
    idea: "Computer vision for manufacturing",
    industry: "industrial ai",
    stage: "mvp",
    challenge: "Need design partners and pilot customers",
    fundingStatus: "friends and family",
    background: "Technical founder with robotics research"
  }
};

describe("Founder GPS E2E Tests", () => {
  let resourceCategories: string[] = [];
  let resources: Record<string, unknown>[] = [];
  let analysisResult: Record<string, unknown>;
  let recommendationsResult: Record<string, unknown>[] = [];
  let routeResult: Record<string, unknown>;

  describe("Health Checks", () => {
    it("should verify all services are running", async () => {
      const services = [
        { name: "Intelligence Service", url: `${BASE_URLS.intelligence}/health` },
        { name: "Resource Service", url: `${BASE_URLS.resource}/health` },
        { name: "Recommendation Service", url: `${BASE_URLS.recommendation}/health` },
        { name: "Routing Service", url: `${BASE_URLS.routing}/health` }
      ];

      for (const { name, url } of services) {
        const response = await fetch(url);
        expect(response.ok, `${name} should be healthy`).toBe(true);
      }
    });
  });

  describe("Happy Path: SaaS Founder Flow", () => {
    const profile = testProfiles.saasFounder;

    it("should fetch resource categories", async () => {
      const response = await fetch(`${BASE_URLS.resource}/resources/categories`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.categories).toBeDefined();
      expect(Array.isArray(data.categories)).toBe(true);
      resourceCategories = data.categories;
    });

    it("should fetch available resources", async () => {
      const params = new URLSearchParams({
        stage: profile.stage,
        industry: profile.industry,
        city: profile.locationCity,
        limit: "20"
      });

      const response = await fetch(`${BASE_URLS.resource}/resources?${params}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.resources).toBeDefined();
      expect(Array.isArray(data.resources)).toBe(true);
      expect(data.resources.length).toBeGreaterThan(0);
      resources = data.resources;
    });

    it("should analyze founder profile", async () => {
      const response = await fetch(`${BASE_URLS.intelligence}/intelligence/analyze-founder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founderProfileId: profile.founderProfileId,
          location: profile.locationCity,
          idea: profile.idea,
          industry: profile.industry,
          stage: profile.stage,
          challenge: profile.challenge,
          fundingStatus: profile.fundingStatus,
          background: profile.background
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.analysis).toBeDefined();

      const { analysis } = data;
      expect(analysis.stage).toBeDefined();
      expect(analysis.primaryNeeds).toBeDefined();
      expect(analysis.secondaryNeeds).toBeDefined();
      expect(analysis.risks).toBeDefined();
      expect(analysis.confidenceScore).toBeDefined();
      expect(typeof analysis.confidenceScore).toBe("number");
      expect(analysis.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(analysis.confidenceScore).toBeLessThanOrEqual(1);

      analysisResult = analysis;
    });

    it("should generate recommendations", async () => {
      const response = await fetch(`${BASE_URLS.recommendation}/recommendations/rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founderProfile: {
            founderProfileId: profile.founderProfileId,
            location: {
              city: profile.locationCity,
              lat: profile.locationLat,
              lng: profile.locationLng
            },
            idea: profile.idea,
            industry: profile.industry,
            stage: profile.stage,
            challenge: profile.challenge,
            fundingStatus: profile.fundingStatus,
            background: profile.background
          },
          founderAnalysis: analysisResult,
          resources,
          topN: 4
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.recommendations).toBeDefined();
      expect(Array.isArray(data.recommendations)).toBe(true);

      for (const rec of data.recommendations) {
        expect(rec.resourceId).toBeDefined();
        expect(rec.score).toBeDefined();
        expect(rec.priority).toMatch(/^(high|medium|low)$/);
        expect(rec.reason).toBeDefined();
        expect(rec.recommendedAction).toBeDefined();
      }

      recommendationsResult = data.recommendations;
    });

    it("should generate founder route", async () => {
      const selectedResources = resources.filter((r: Record<string, unknown>) =>
        recommendationsResult.some((rec: Record<string, unknown>) => rec.resourceId === r.id)
      );

      const response = await fetch(`${BASE_URLS.routing}/routing/founder-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: {
            city: profile.locationCity,
            lat: profile.locationLat,
            lng: profile.locationLng
          },
          resources: selectedResources,
          topN: 3,
          roundtrip: false
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.orderedStops).toBeDefined();
      expect(data.totalDriveTimeMinutes).toBeDefined();
      expect(data.totalDistanceMiles).toBeDefined();
      expect(data.geojson).toBeDefined();

      routeResult = data;
    });

    it("should generate 30-day roadmap", async () => {
      const response = await fetch(`${BASE_URLS.intelligence}/intelligence/generate-roadmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founderProfileId: profile.founderProfileId,
          founderSummary: `${profile.locationCity} founder building ${profile.idea}`,
          stage: analysisResult.stage,
          needs: (analysisResult.primaryNeeds as string[]).slice(0, 3),
          recommendations: recommendationsResult
            .slice(0, 3)
            .map((r: Record<string, unknown>) => `${r.resourceName}: ${r.recommendedAction}`)
            .filter(Boolean),
          constraints: [profile.fundingStatus, profile.challenge]
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.roadmap).toBeDefined();
      expect(data.roadmap.weeks).toBeDefined();
      expect(Array.isArray(data.roadmap.weeks)).toBe(true);
      expect(data.roadmap.weeks.length).toBeGreaterThan(0);

      for (const week of data.roadmap.weeks) {
        expect(week.weekNumber).toBeDefined();
        expect(week.goal).toBeDefined();
        expect(week.tasks).toBeDefined();
      }
    });
  });

  describe("Founder Flow API", () => {
    it("should complete full founder flow via API", async () => {
      const profile = testProfiles.deeptech;

      const response = await fetch(`${BASE_URLS.web}/api/founder-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.founderProfile).toBeDefined();
      expect(data.analysis).toBeDefined();
      expect(data.recommendations).toBeDefined();
      expect(Array.isArray(data.recommendations)).toBe(true);
      expect(data.resources).toBeDefined();
      expect(data.requestId).toBeDefined();

      // Route and roadmap are optional but should be attempted
      if (data.route) {
        expect(data.route.orderedStops).toBeDefined();
        expect(data.route.totalDriveTimeMinutes).toBeDefined();
      }

      if (data.roadmap) {
        expect(data.roadmap.weeks).toBeDefined();
      }

      // Check for helpful warnings if optional services failed
      if (data.warnings && Array.isArray(data.warnings)) {
        for (const warning of data.warnings) {
          expect(typeof warning).toBe("string");
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid founder profile", async () => {
      const response = await fetch(`${BASE_URLS.web}/api/founder-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationCity: "Lehi"
          // Missing required fields
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should handle missing resources gracefully", async () => {
      const profile = {
        ...testProfiles.saasFounder,
        founderProfileId: "test-missing-" + Date.now(),
        locationCity: "NonExistentCity"
      };

      const response = await fetch(`${BASE_URLS.web}/api/founder-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });

      // Should still succeed with whatever recommendations are available
      expect([200, 503]).toContain(response.status);
    });
  });

  describe("Performance", () => {
    it("should complete full flow within reasonable time", async () => {
      const profile = testProfiles.saasFounder;
      const startTime = Date.now();

      const response = await fetch(`${BASE_URLS.web}/api/founder-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          founderProfileId: "perf-test-" + Date.now()
        })
      });

      const elapsed = Date.now() - startTime;
      expect(response.ok).toBe(true);
      expect(elapsed).toBeLessThan(30000); // Should complete in less than 30 seconds
    });
  });
});
