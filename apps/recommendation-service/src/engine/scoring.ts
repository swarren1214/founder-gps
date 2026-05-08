import crypto from "node:crypto";
import type {
  FounderAnalysis,
  FounderProfileInput,
  Recommendation,
  StartupResource
} from "../types.js";

const WEIGHTS = {
  stageMatch: 0.35,
  needMatch: 0.25,
  industryMatch: 0.15,
  proximity: 0.15,
  urgency: 0.1
} as const;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function similarityByIntersection(a: string[], b: string[]): number {
  const setA = new Set(a.map(normalizeText));
  const setB = new Set(b.map(normalizeText));

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const value of setA) {
    if (setB.has(value)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(setA.size, setB.size);
}

function scoreStageMatch(resource: StartupResource, founderStage: string): number {
  return resource.stageFit.map(normalizeText).includes(normalizeText(founderStage)) ? 100 : 25;
}

function scoreNeedMatch(resource: StartupResource, analysis: FounderAnalysis): number {
  const resourceTags = [resource.category, ...resource.tags, ...resource.industryFit];
  const needs = [...analysis.primaryNeeds, ...analysis.secondaryNeeds];
  return Math.round(similarityByIntersection(resourceTags, needs) * 100);
}

function scoreIndustryMatch(resource: StartupResource, founderIndustry?: string): number {
  if (!founderIndustry) {
    return 50;
  }

  const normalizedIndustry = normalizeText(founderIndustry);
  return resource.industryFit.map(normalizeText).includes(normalizedIndustry) ? 100 : 30;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function scoreProximity(resource: StartupResource, founderProfile: FounderProfileInput): number {
  if (typeof founderProfile.location.lat !== "number" || typeof founderProfile.location.lng !== "number") {
    return 50;
  }

  const distance = haversineMiles(
    founderProfile.location.lat,
    founderProfile.location.lng,
    resource.lat,
    resource.lng
  );

  if (distance <= 5) return 100;
  if (distance <= 15) return 85;
  if (distance <= 30) return 70;
  if (distance <= 60) return 50;
  return 25;
}

function scoreUrgency(founderProfile: FounderProfileInput): number {
  const challenge = normalizeText(founderProfile.challenge);
  const urgentKeywords = ["urgent", "stuck", "asap", "runway", "funding", "blocked"];

  const hasUrgentSignal = urgentKeywords.some((keyword) => challenge.includes(keyword));
  if (hasUrgentSignal) {
    return 90;
  }

  if (["idea", "validation"].includes(founderProfile.stage)) {
    return 80;
  }

  return 65;
}

function priorityFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

export function computeRecommendation(
  founderProfile: FounderProfileInput,
  analysis: FounderAnalysis,
  resource: StartupResource
): Omit<Recommendation, "reason" | "recommendedAction"> {
  const stageMatch = scoreStageMatch(resource, analysis.stage);
  const needMatch = scoreNeedMatch(resource, analysis);
  const industryMatch = scoreIndustryMatch(resource, founderProfile.industry ?? analysis.industry);
  const proximity = scoreProximity(resource, founderProfile);
  const urgency = scoreUrgency(founderProfile);

  const score =
    stageMatch * WEIGHTS.stageMatch +
    needMatch * WEIGHTS.needMatch +
    industryMatch * WEIGHTS.industryMatch +
    proximity * WEIGHTS.proximity +
    urgency * WEIGHTS.urgency;

  return {
    id: crypto.randomUUID(),
    founderProfileId: founderProfile.founderProfileId,
    resourceId: resource.id,
    resourceName: resource.name,
    score: Math.round(score * 100) / 100,
    priority: priorityFromScore(score),
    scoreBreakdown: {
      stageMatch,
      needMatch,
      industryMatch,
      proximity,
      urgency
    },
    createdAt: new Date().toISOString()
  };
}

export function rankRecommendations(
  founderProfile: FounderProfileInput,
  analysis: FounderAnalysis,
  resources: StartupResource[]
): Omit<Recommendation, "reason" | "recommendedAction">[] {
  return resources
    .map((resource) => computeRecommendation(founderProfile, analysis, resource))
    .sort((a, b) => b.score - a.score);
}
