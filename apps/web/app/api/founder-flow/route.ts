import { NextResponse } from "next/server";
import { founderFlowResponseSchema, founderIntakeSchema, type FounderIntake } from "@/lib/schemas";
import type { StartupProfile, StartupResource } from "@founder-gps/shared-types";
import {
  getIntelligenceServiceUrl,
  getRecommendationServiceUrl,
  getResourceServiceUrl,
  getRoutingServiceUrl
} from "@/lib/service-urls";

const serviceConfig = {
  resource: getResourceServiceUrl(),
  intelligence: getIntelligenceServiceUrl(),
  recommendation: getRecommendationServiceUrl(),
  routing: getRoutingServiceUrl()
};

type AnalysisPayload = {
  analysis: {
    stage: string;
    primaryNeeds: string[];
    secondaryNeeds: string[];
  };
};

type RecommendationPayload = {
  recommendations: Array<{
    resourceId: string;
    recommendedAction: string;
    resourceName?: string;
  }>;
};

// Generate a unique request ID for traceability across service calls
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

async function parseJson(response: Response) {
  const rawBody = await response.text();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  let payload: unknown = null;
  if (rawBody.length > 0) {
    const looksLikeJson =
      contentType.includes("application/json") ||
      rawBody.trimStart().startsWith("{") ||
      rawBody.trimStart().startsWith("[");

    if (looksLikeJson) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        const truncatedBody = rawBody.slice(0, 180).replace(/\s+/g, " ").trim();
        throw new Error(
          `Upstream returned invalid JSON (status ${response.status}${truncatedBody ? `): ${truncatedBody}` : ")"}`
        );
      }
    }
  }

  if (!response.ok) {
    const payloadRecord = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const maybeError = payloadRecord?.error;
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

    const truncatedBody = rawBody.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(
      truncatedBody
        ? `Request failed with ${response.status}: ${truncatedBody}`
        : `Request failed with ${response.status}`
    );
  }

  if (payload === null) {
    throw new Error(`Expected JSON response but got empty/non-JSON body (status ${response.status})`);
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
  const strictQuery = new URLSearchParams();
  strictQuery.set("limit", String(Math.max(input.topN * 4, 16)));
  if (input.category) strictQuery.set("category", input.category);
  if (input.cityFilter) strictQuery.set("city", input.cityFilter);
  strictQuery.set("stage", input.stage);
  strictQuery.set("industry", input.industry);
  strictQuery.set("lat", String(input.locationLat));
  strictQuery.set("lng", String(input.locationLng));
  strictQuery.set("radiusMiles", "75");

  const strictResponse = await fetchWithTimeout(
    `${serviceConfig.resource}/resources?${strictQuery.toString()}`,
    { timeout: 8000 },
    requestId
  );
  const strictPayload = (await parseJson(strictResponse)) as { resources?: unknown };
  const strictResources = Array.isArray(strictPayload.resources)
    ? (strictPayload.resources as StartupResource[])
    : [];

  // When strict matching returns too few records, broaden the pool so the Resources tab
  // and map remain populated while recommendations still prioritize strict-fit entries.
  if (strictResources.length >= 12) {
    return strictResources;
  }

  const broadQuery = new URLSearchParams();
  broadQuery.set("limit", "500");
  if (input.category) broadQuery.set("category", input.category);
  if (input.cityFilter) broadQuery.set("city", input.cityFilter);
  broadQuery.set("lat", String(input.locationLat));
  broadQuery.set("lng", String(input.locationLng));
  broadQuery.set("radiusMiles", "250");

  const broadResponse = await fetchWithTimeout(
    `${serviceConfig.resource}/resources?${broadQuery.toString()}`,
    { timeout: 8000 },
    requestId
  );
  const broadPayload = (await parseJson(broadResponse)) as { resources?: unknown };
  const broadResources = Array.isArray(broadPayload.resources)
    ? (broadPayload.resources as StartupResource[])
    : [];

  const mergedById = new Map<string, StartupResource>();
  for (const resource of strictResources) {
    mergedById.set(resource.id, resource);
  }
  for (const resource of broadResources) {
    if (!mergedById.has(resource.id)) {
      mergedById.set(resource.id, resource);
    }
  }

  return Array.from(mergedById.values());
}

async function fetchStartups(_input: FounderIntake, requestId: string): Promise<StartupProfile[]> {
  const query = new URLSearchParams();
  query.set("limit", "1000");

  const response = await fetchWithTimeout(
    `${serviceConfig.resource}/startups?${query.toString()}`,
    { timeout: 8000 },
    requestId
  );
  const payload = (await parseJson(response)) as { startups?: unknown };
  return Array.isArray(payload.startups) ? (payload.startups as StartupProfile[]) : [];
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
    let analysisPayload: AnalysisPayload | null = null;
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
      const parsedAnalysis = (await parseJson(analysisResponse)) as { analysis?: unknown };
      const analysis = parsedAnalysis.analysis;

      if (!analysis || typeof analysis !== "object") {
        throw new Error("Analysis response missing analysis payload.");
      }

      const analysisRecord = analysis as {
        stage?: unknown;
        primaryNeeds?: unknown;
        secondaryNeeds?: unknown;
      };

      if (typeof analysisRecord.stage !== "string") {
        throw new Error("Analysis response missing stage.");
      }

      analysisPayload = {
        analysis: {
          stage: analysisRecord.stage,
          primaryNeeds: Array.isArray(analysisRecord.primaryNeeds)
            ? analysisRecord.primaryNeeds.filter((item): item is string => typeof item === "string")
            : [],
          secondaryNeeds: Array.isArray(analysisRecord.secondaryNeeds)
            ? analysisRecord.secondaryNeeds.filter((item): item is string => typeof item === "string")
            : []
        }
      };
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
    let recommendationPayload: RecommendationPayload | null = null;
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
            startups: startups.map((startup) => ({
              id: startup.id,
              name: startup.name,
              sector: startup.sector,
              city: startup.address ?? null,
              description: startup.description,
              stageKeywords: startup.stage ? [startup.stage] : [],
              hiringStatus: startup.hiringStatus
            })),
            topN: founderProfile.topN
          }),
          timeout: 8000
        },
        requestId
      );
      const parsedRecommendations = (await parseJson(recommendationResponse)) as { recommendations?: unknown };
      const recommendations = Array.isArray(parsedRecommendations.recommendations)
        ? parsedRecommendations.recommendations
            .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
            .filter((item) => typeof item.resourceId === "string" && typeof item.recommendedAction === "string")
            .map((item) => ({
              resourceId: item.resourceId as string,
              recommendedAction: item.recommendedAction as string,
              resourceName: typeof item.resourceName === "string" ? item.resourceName : undefined
            }))
        : [];

      recommendationPayload = { recommendations };
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
    if (serviceConfig.routing) {
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
              (item) =>
                `${item.resourceName ?? "Resource"}: ${item.recommendedAction}`
            ),
            constraints: [founderProfile.fundingStatus, founderProfile.challenge].filter(Boolean)
          }),
          timeout: 8000
        },
        requestId
      );
      const roadmapPayload = (await parseJson(roadmapResponse)) as { roadmap?: unknown };
      roadmap = roadmapPayload.roadmap ?? null;
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
