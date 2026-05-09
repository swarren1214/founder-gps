import type { IntelligenceClient } from "./clients/intelligence-client.js";
import type { LlmRecommendationClient } from "./clients/openai-recommendation-client.js";
import type { ResourceClient } from "./clients/resource-client.js";
import { rankRecommendations } from "./engine/scoring.js";
import type {
  FounderAnalysis,
  FounderProfileInput,
  GenerateRecommendationsRequest,
  Recommendation,
  StartupResource
} from "./types.js";
import type { RecommendationRepository } from "./repository.js";

function compactFounderSummary(founderProfile: FounderProfileInput, analysis: FounderAnalysis): string {
  return [
    `Stage: ${analysis.stage}`,
    `Idea: ${founderProfile.idea}`,
    `Industry: ${founderProfile.industry ?? analysis.industry}`,
    `Challenge: ${founderProfile.challenge}`,
    `Primary needs: ${analysis.primaryNeeds.join(", ")}`
  ].join(" | ");
}

export class RecommendationService {
  constructor(
    private readonly resourceClient: ResourceClient,
    private readonly intelligenceClient: IntelligenceClient,
    private readonly repository: RecommendationRepository,
    private readonly llmRecommendationClient?: LlmRecommendationClient
  ) {}

  async rank(params: {
    founderProfile: FounderProfileInput;
    founderAnalysis: FounderAnalysis;
    resources: StartupResource[];
    topN: number;
  }): Promise<Recommendation[]> {
    const ranked = rankRecommendations(params.founderProfile, params.founderAnalysis, params.resources);

    const founderSummary = compactFounderSummary(params.founderProfile, params.founderAnalysis);

    if (this.llmRecommendationClient) {
      try {
        const llmRecommendations = await this.llmRecommendationClient.recommend({
          founderProfile: params.founderProfile,
          founderAnalysis: params.founderAnalysis,
          resources: params.resources,
          topN: params.topN
        });

        const rankedByResourceId = new Map(ranked.map((item) => [item.resourceId, item]));
        const resourcesById = new Map(params.resources.map((resource) => [resource.id, resource]));
        const merged: Recommendation[] = [];
        const usedResourceIds = new Set<string>();

        for (const llmItem of llmRecommendations) {
          const base = rankedByResourceId.get(llmItem.resourceId);
          if (!base) {
            continue;
          }

          usedResourceIds.add(llmItem.resourceId);
          merged.push({
            ...base,
            resourceName: resourcesById.get(base.resourceId)?.name ?? base.resourceName,
            reason: llmItem.reason,
            recommendedAction: llmItem.recommendedAction
          });

          if (merged.length >= params.topN) {
            break;
          }
        }

        if (merged.length > 0) {
          for (const fallbackItem of ranked) {
            if (merged.length >= params.topN) {
              break;
            }
            if (usedResourceIds.has(fallbackItem.resourceId)) {
              continue;
            }

            merged.push({
              ...fallbackItem,
              reason:
                `Strong fit based on stage (${fallbackItem.scoreBreakdown.stageMatch}), need match ` +
                `(${fallbackItem.scoreBreakdown.needMatch}), and proximity (${fallbackItem.scoreBreakdown.proximity}).`,
              recommendedAction: "Schedule a first outreach with a clear ask tied to your immediate milestone."
            });
          }

          return merged;
        }
      } catch {
        // Fall back to deterministic ranking and intelligence explanations.
      }
    }

    const topRanked = ranked.slice(0, params.topN);

    const explained = await Promise.all(
      topRanked.map(async (item) => {
        const resource = params.resources.find((r) => r.id === item.resourceId);
        const generatedReason =
          `Scored ${item.score.toFixed(2)} with stage=${item.scoreBreakdown.stageMatch}, ` +
          `needs=${item.scoreBreakdown.needMatch}, industry=${item.scoreBreakdown.industryMatch}, ` +
          `proximity=${item.scoreBreakdown.proximity}, urgency=${item.scoreBreakdown.urgency}.`;

        const explanation = await this.intelligenceClient.explainRecommendation({
          founderSummary,
          recommendationName: item.resourceName,
          recommendationReason: generatedReason,
          score: item.score
        });

        return {
          ...item,
          resourceName: resource?.name ?? item.resourceName,
          reason: explanation.explanation,
          recommendedAction: explanation.founderAction
        } as Recommendation;
      })
    );

    return explained;
  }

  async generate(request: GenerateRecommendationsRequest): Promise<Recommendation[]> {
    const founderAnalysis =
      request.founderAnalysis ??
      (await this.intelligenceClient.analyzeFounder({
        founderProfileId: request.founderProfile.founderProfileId,
        location: request.founderProfile.location.city,
        idea: request.founderProfile.idea,
        industry: request.founderProfile.industry,
        stage: request.founderProfile.stage,
        challenge: request.founderProfile.challenge,
        fundingStatus: request.founderProfile.fundingStatus,
        background: request.founderProfile.background
      }));

    const resources = await this.resourceClient.fetchResources({
      category: request.filters.category,
      city: request.filters.city,
      limit: request.filters.limit
    });

    const ranked = await this.rank({
      founderProfile: request.founderProfile,
      founderAnalysis,
      resources,
      topN: request.topN
    });

    return this.repository.saveRecommendations({
      founderProfileId: request.founderProfile.founderProfileId,
      recommendations: ranked,
      recompute: request.recompute
    });
  }
}
