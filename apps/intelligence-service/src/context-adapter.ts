import crypto from "node:crypto";
import { FOUNDER_STAGES } from "@founder-gps/shared-types";
import type {
  ChatContextBundle,
  FounderStage,
  FounderProfileContext,
  StylePrefs
} from "@founder-gps/shared-types";
import type { IntelligenceRepository } from "./repository.js";

type ContextAdapterOptions = {
  repository: IntelligenceRepository;
  resourceServiceUrl: string;
  recommendationServiceUrl: string;
  fetchImpl?: typeof fetch;
  tokenBudget?: number;
};

type BuildContextInput = {
  sessionId: string;
  userId: string;
  message: string;
  stylePrefs?: StylePrefs;
};

type RecommendationRecord = Array<Record<string, unknown>>;

function estimateTokens(input: string): number {
  return Math.max(1, Math.ceil(input.length / 4));
}

function hashBundle(bundle: ChatContextBundle): string {
  return crypto.createHash("sha256").update(JSON.stringify(bundle)).digest("hex");
}

async function fetchJson<T>(fetchImpl: typeof fetch, url: string): Promise<T | null> {
  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function toFounderProfileContext(
  profile: Awaited<ReturnType<IntelligenceRepository["getFounderProfileByUserId"]>>
): FounderProfileContext | null {
  if (!profile) {
    return null;
  }

  if (!FOUNDER_STAGES.includes(profile.stage as FounderStage)) {
    return null;
  }

  return {
    ...profile,
    stage: profile.stage as FounderStage
  };
}

function makeSummary(
  profile: FounderProfileContext | null,
  recommendations: RecommendationRecord,
  resourcesCount: number,
  startupsCount: number
): string {
  if (!profile) {
    return "No founder profile found yet; chat will stay generic until the profile is created.";
  }

  return `${profile.locationCity} founder at ${profile.stage} stage, with ${recommendations.length} recommendation(s), ${resourcesCount} resource(s), and ${startupsCount} startup profile(s) in context.`;
}

export async function buildContextBundle(
  input: BuildContextInput,
  options: ContextAdapterOptions
): Promise<ChatContextBundle> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const warnings: string[] = [];

  const founderProfile = toFounderProfileContext(await options.repository.getFounderProfileByUserId(input.userId));
  const founderAnalysisSnapshot = founderProfile
    ? await options.repository.getLatestFounderAnalysisSnapshotByFounderProfileId(founderProfile.id)
    : null;

  const recommendationUrl = founderProfile
    ? `${options.recommendationServiceUrl}/recommendations/replay/${founderProfile.id}`
    : null;
  const recommendationPayload = recommendationUrl
    ? await fetchJson<{ recommendations?: RecommendationRecord }>(fetchImpl, recommendationUrl)
    : null;
  const recommendations = recommendationPayload?.recommendations ?? [];
  if (recommendationUrl && !recommendationPayload) {
    warnings.push("Recommendation history unavailable right now.");
  }

  const resourceQuery = new URLSearchParams({ limit: "12" });
  if (founderProfile?.locationCity) resourceQuery.set("city", founderProfile.locationCity);
  if (founderProfile?.stage) resourceQuery.set("stage", founderProfile.stage);
  if (founderProfile?.industry) resourceQuery.set("industry", founderProfile.industry);

  const resourcePayload = await fetchJson<{ resources?: ChatContextBundle["resources"] }>(
    fetchImpl,
    `${options.resourceServiceUrl}/resources?${resourceQuery.toString()}`
  );
  const resources = resourcePayload?.resources ?? [];
  if (!resourcePayload) {
    warnings.push("Resource catalog unavailable right now.");
  }

  const startupQuery = new URLSearchParams({ limit: "12" });
  if (founderProfile?.locationCity) startupQuery.set("city", founderProfile.locationCity);
  const startupPayload = await fetchJson<{ startups?: ChatContextBundle["startups"] }>(
    fetchImpl,
    `${options.resourceServiceUrl}/startups?${startupQuery.toString()}`
  );
  const startups = startupPayload?.startups ?? [];
  if (!startupPayload) {
    warnings.push("Startup catalog unavailable right now.");
  }

  const context: ChatContextBundle = {
    founderProfile,
    founderAnalysisSnapshot,
    recommendations,
    resources,
    startups,
    conversationSummary: makeSummary(founderProfile, recommendations, resources.length, startups.length),
    warnings
  };

  const tokenCount = estimateTokens(JSON.stringify(context));
  if (tokenCount <= (options.tokenBudget ?? 6000)) {
    return context;
  }

  return {
    ...context,
    recommendations: recommendations.slice(0, 3),
    resources: resources.slice(0, 3),
    startups: startups.slice(0, 3),
    conversationSummary: `${context.conversationSummary} Context was compacted to fit the token budget.`
  };
}
