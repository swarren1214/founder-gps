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

// ---------------------------------------------------------------------------
// Auth Service E2E Tests
// ---------------------------------------------------------------------------

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:4005";
const AUTH_COOKIE_NAME = "fg_session";

function extractSetCookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

describe("Auth Service E2E", () => {
  const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  describe("Health", () => {
    it("auth-service health endpoint returns ok", async () => {
      const response = await fetch(`${AUTH_SERVICE_URL}/health`);
      expect(response.ok).toBe(true);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });

  describe("Registration flow", () => {
    it("registers a new user and returns authenticated user payload with session cookie", async () => {
      const email = uniqueEmail();
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "securepassword1" })
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user.email).toBe(email);
      expect(body.profile.onboardingStatus).toBe("not_started");
      expect(body.user.passwordHash).toBeUndefined();

      const cookie = response.headers.get("set-cookie");
      const token = extractSetCookieValue(cookie, AUTH_COOKIE_NAME);
      expect(token).toBeTruthy();
    });

    it("rejects duplicate registration for the same email", async () => {
      const email = uniqueEmail();
      const payload = { email, password: "securepassword1" };

      const first = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      expect(first.status).toBe(200);

      const second = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      expect(second.status).toBe(409);
    });

    it("rejects registration with missing fields", async () => {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: uniqueEmail() })
      });
      expect(response.status).toBe(400);
    });
  });

  describe("Login flow", () => {
    it("logs in with valid credentials and returns a session cookie", async () => {
      const email = uniqueEmail();
      const password = "securepassword1";

      await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const loginResponse = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      expect(loginResponse.status).toBe(200);
      const body = await loginResponse.json();
      expect(body.user.email).toBe(email);
      const cookie = loginResponse.headers.get("set-cookie");
      expect(extractSetCookieValue(cookie, AUTH_COOKIE_NAME)).toBeTruthy();
    });

    it("rejects login with wrong password", async () => {
      const email = uniqueEmail();
      await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "correctpassword1" })
      });

      const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "wrongpassword1" })
      });
      expect(response.status).toBe(401);
    });
  });

  describe("Protected endpoints", () => {
    async function registerAndGetToken(email: string): Promise<string> {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "securepassword1" })
      });
      const cookie = response.headers.get("set-cookie");
      return extractSetCookieValue(cookie, AUTH_COOKIE_NAME) ?? "";
    }

    it("GET /auth/me returns 401 without a session token", async () => {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/me`);
      expect(response.status).toBe(401);
    });

    it("GET /auth/me returns 401 with an invalid session token", async () => {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=invalid-token-value` }
      });
      expect(response.status).toBe(401);
    });

    it("GET /auth/me returns the authenticated user after registration", async () => {
      const email = uniqueEmail();
      const token = await registerAndGetToken(email);

      const meResponse = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` }
      });

      expect(meResponse.status).toBe(200);
      const body = await meResponse.json();
      expect(body.user.email).toBe(email);
      expect(body.profile).toBeDefined();
    });

    it("PATCH /profile persists profile updates and marks onboarding completed", async () => {
      const email = uniqueEmail();
      const token = await registerAndGetToken(email);

      const patchResponse = await fetch(`${AUTH_SERVICE_URL}/profile`, {
        method: "PATCH",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          locationCity: "Lehi",
          companyName: "Acme Startup",
          onboardingStatus: "completed"
        })
      });

      expect(patchResponse.status).toBe(200);
      const body = await patchResponse.json();
      expect(body.profile.locationCity).toBe("Lehi");
      expect(body.profile.companyName).toBe("Acme Startup");
      expect(body.profile.onboardingStatus).toBe("completed");
      expect(body.profile.onboardingCompletedAt).not.toBeNull();
    });

    it("PATCH /profile returns 401 without session", async () => {
      const response = await fetch(`${AUTH_SERVICE_URL}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationCity: "Hacker City" })
      });
      expect(response.status).toBe(401);
    });
  });

  describe("Logout flow", () => {
    it("POST /auth/logout invalidates the session and subsequent /auth/me returns 401", async () => {
      const email = uniqueEmail();
      const registerResponse = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "securepassword1" })
      });
      const token = extractSetCookieValue(registerResponse.headers.get("set-cookie"), AUTH_COOKIE_NAME);
      expect(token).toBeTruthy();

      const logoutResponse = await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` }
      });
      expect(logoutResponse.status).toBe(200);

      const meResponse = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` }
      });
      expect(meResponse.status).toBe(401);
    });

    it("POST /auth/logout returns ok even without a session cookie", async () => {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/logout`, { method: "POST" });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });

  describe("Avatar upload flow", () => {
    it("uploads an avatar, reads it back, and deletes it", async () => {
      const email = uniqueEmail();
      const registerResponse = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "securepassword1" })
      });
      const token = extractSetCookieValue(registerResponse.headers.get("set-cookie"), AUTH_COOKIE_NAME);

      // Build a minimal valid PNG (1x1 pixel)
      const minimalPng = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
        "2e000000000c4944415408d76360f8cfc000000002000134e3d900000000049454e44ae426082",
        "hex"
      );
      const boundary = `----boundary${Date.now()}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`, "utf8"),
        minimalPng,
        Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")
      ]);

      const uploadResponse = await fetch(`${AUTH_SERVICE_URL}/profile/avatar`, {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
          "content-type": `multipart/form-data; boundary=${boundary}`
        },
        body
      });

      expect(uploadResponse.status).toBe(200);
      const uploadBody = await uploadResponse.json();
      expect(uploadBody.profile.avatarUrl).toBeTruthy();
      const storageKey = uploadBody.profile.avatarStorageKey;
      expect(storageKey).toBeTruthy();

      const readResponse = await fetch(`${AUTH_SERVICE_URL}/profile/avatar/${storageKey}`);
      expect(readResponse.status).toBe(200);
      expect(readResponse.headers.get("content-type")).toContain("image/png");

      const deleteResponse = await fetch(`${AUTH_SERVICE_URL}/profile/avatar`, {
        method: "DELETE",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` }
      });
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();
      expect(deleteBody.profile.avatarUrl).toBeNull();
    });

    it("rejects non-image uploads with 400", async () => {
      const email = uniqueEmail();
      const registerResponse = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "securepassword1" })
      });
      const token = extractSetCookieValue(registerResponse.headers.get("set-cookie"), AUTH_COOKIE_NAME);

      const boundary = `----boundary${Date.now()}`;
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="file.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary}--\r\n`;

      const response = await fetch(`${AUTH_SERVICE_URL}/profile/avatar`, {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
          "content-type": `multipart/form-data; boundary=${boundary}`
        },
        body
      });
      expect(response.status).toBe(400);
    });
  });
});
