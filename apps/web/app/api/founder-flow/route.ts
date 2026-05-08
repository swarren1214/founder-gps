import { NextResponse } from "next/server";
import { founderFlowResponseSchema, founderIntakeSchema, type FounderIntake } from "@/lib/schemas";
import type { StartupProfile, StartupResource } from "@founder-gps/shared-types";

const serviceConfig = {
  resource: process.env.NEXT_PUBLIC_RESOURCE_SERVICE_URL ?? "http://localhost:4001",
  intelligence: process.env.NEXT_PUBLIC_INTELLIGENCE_SERVICE_URL ?? "http://localhost:4003",
  recommendation: process.env.NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL ?? "http://localhost:4004",
  routing: process.env.NEXT_PUBLIC_ROUTING_SERVICE_URL ?? "http://localhost:4002"
};

// Generate a unique request ID for traceability across service calls
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

async function parseJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    const maybeError = payload?.error;
    if (typeof maybeError === "string") {
      throw new Error(maybeError);
    }

    if (maybeError && typeof maybeError === "object") {
      const code = "code" in maybeError ? String(maybeError.code) : "UNKNOWN_ERROR";
      const message = "message" in maybeError ? String(maybeError.message) : `Request failed with ${response.status}`;
      const details = "details" in maybeError && maybeError.details
        ? ` Details: ${JSON.stringify(maybeError.details)}`
        : "";
      throw new Error(`${code}: ${message}${details}`);
    }

    throw new Error(`Request failed with ${response.status}`);
  }
  return payload;
}

// Fetch with timeout support
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
  requestId: string
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  headers.set("X-Request-ID", requestId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
      cache: "no-store"
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchResources(input: FounderIntake, requestId: string): Promise<StartupResource[]> {
  const query = new URLSearchParams();
  query.set("limit", String(Math.max(input.topN * 4, 16)));
  if (input.category) query.set("category", input.category);
  if (input.cityFilter) query.set("city", input.cityFilter);
  query.set("stage", input.stage);
  query.set("industry", input.industry);
  query.set("lat", String(input.locationLat));
  query.set("lng", String(input.locationLng));
  query.set("radiusMiles", "75");

  const response = await fetchWithTimeout(
    `${serviceConfig.resource}/resources?${query.toString()}`,
    { timeout: 8000 },
    requestId
  );
  const payload = await parseJson(response);
  return payload.resources;
}

async function fetchStartups(_input: FounderIntake, requestId: string): Promise<StartupProfile[]> {
  const query = new URLSearchParams();
  query.set("limit", "1000");

  const response = await fetchWithTimeout(
    `${serviceConfig.resource}/startups?${query.toString()}`,
    { timeout: 8000 },
    requestId
  );
  const payload = await parseJson(response);
  return payload.startups;
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  
  try {
    const parsed = founderIntakeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), requestId },
        { status: 400 }
      );
    }

    const founderProfile = parsed.data;
    const warnings: string[] = [];

    // Step 1: Analyze founder
    let analysisPayload;
    try {
      const analysisResponse = await fetchWithTimeout(
        `${serviceConfig.intelligence}/intelligence/analyze-founder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founderProfileId: founderProfile.founderProfileId,
            location: founderProfile.locationCity,
            idea: founderProfile.idea,
            industry: founderProfile.industry,
            stage: founderProfile.stage,
            challenge: founderProfile.challenge,
            fundingStatus: founderProfile.fundingStatus,
            background: founderProfile.background
          }),
          timeout: 8000
        },
        requestId
      );
      analysisPayload = await parseJson(analysisResponse);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Founder analysis failed";
      return NextResponse.json(
        { error: `Analysis service error: ${errorMsg}`, requestId },
        { status: 503 }
      );
    }

    // Step 2: Fetch resources
    let resources: StartupResource[];
    try {
      resources = await fetchResources(founderProfile, requestId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Resource fetch failed";
      return NextResponse.json(
        { error: `Resource service error: ${errorMsg}`, requestId },
        { status: 503 }
      );
    }

    let startups: StartupProfile[] = [];
    try {
      startups = await fetchStartups(founderProfile, requestId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Startup list unavailable";
      warnings.push(`⚠️ Startup profiles unavailable: ${errorMsg}. Startups tab may be empty.`);
    }

    // Step 3: Generate recommendations
    let recommendationPayload;
    try {
      const recommendationResponse = await fetchWithTimeout(
        `${serviceConfig.recommendation}/recommendations/rank`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founderProfile: {
              founderProfileId: founderProfile.founderProfileId,
              location: {
                city: founderProfile.locationCity,
                lat: founderProfile.locationLat,
                lng: founderProfile.locationLng
              },
              idea: founderProfile.idea,
              industry: founderProfile.industry,
              stage: founderProfile.stage,
              challenge: founderProfile.challenge,
              fundingStatus: founderProfile.fundingStatus,
              background: founderProfile.background
            },
            founderAnalysis: analysisPayload.analysis,
            resources,
            topN: founderProfile.topN
          }),
          timeout: 8000
        },
        requestId
      );
      recommendationPayload = await parseJson(recommendationResponse);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Recommendation generation failed";
      return NextResponse.json(
        { error: `Recommendation service error: ${errorMsg}`, requestId },
        { status: 503 }
      );
    }

    const selectedResources = resources.filter((resource) =>
      recommendationPayload.recommendations.some((item: { resourceId: string }) => item.resourceId === resource.id)
    );

    // Step 4: Generate route (optional, failures logged as warnings)
    let route = null;
    try {
      const routeResponse = await fetchWithTimeout(
        `${serviceConfig.routing}/routing/founder-path`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: {
              city: founderProfile.locationCity,
              lat: founderProfile.locationLat,
              lng: founderProfile.locationLng
            },
            resources: selectedResources,
            topN: founderProfile.topN,
            roundtrip: false
          }),
          timeout: 8000
        },
        requestId
      );
      route = await parseJson(routeResponse);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Routing service unavailable";
      warnings.push(`⚠️ Routing unavailable: ${errorMsg}. Map visualization may be limited.`);
    }

    // Step 5: Generate roadmap (optional, failures logged as warnings)
    let roadmap = null;
    try {
      const roadmapResponse = await fetchWithTimeout(
        `${serviceConfig.intelligence}/intelligence/generate-roadmap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founderProfileId: founderProfile.founderProfileId,
            founderSummary: `${founderProfile.locationCity} founder building ${founderProfile.idea}`,
            stage: analysisPayload.analysis.stage,
            needs: [
              ...analysisPayload.analysis.primaryNeeds,
              ...analysisPayload.analysis.secondaryNeeds
            ].slice(0, 5),
            recommendations: recommendationPayload.recommendations.map(
              (item: { recommendedAction: string; resourceName: string }) =>
                `${item.resourceName}: ${item.recommendedAction}`
            ),
            constraints: [founderProfile.fundingStatus, founderProfile.challenge].filter(Boolean)
          }),
          timeout: 8000
        },
        requestId
      );
      const roadmapPayload = await parseJson(roadmapResponse);
      roadmap = roadmapPayload.roadmap;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Roadmap generation unavailable";
      warnings.push(`⚠️ Roadmap generation unavailable: ${errorMsg}. Use recommendations as action items.`);
    }

    const responsePayload = founderFlowResponseSchema.parse({
      founderProfile,
      analysis: analysisPayload.analysis,
      recommendations: recommendationPayload.recommendations,
      route,
      roadmap,
      resources,
      startups,
      warnings
    });

    return NextResponse.json({ ...responsePayload, requestId });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown founder flow error";
    console.error(`[${requestId}] Founder flow error:`, error);
    return NextResponse.json(
      {
        error: errorMsg,
        requestId,
        hint: "Check that all backend services are running and accessible."
      },
      { status: 500 }
    );
  }
}
