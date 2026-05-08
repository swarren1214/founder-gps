import type { IntelligenceClient } from "./clients/intelligence-client.js";
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
    private readonly repository: RecommendationRepository
  ) {}

  async rank(params: {
    founderProfile: FounderProfileInput;
    founderAnalysis: FounderAnalysis;
    resources: StartupResource[];
    topN: number;
  }): Promise<Recommendation[]> {
    const ranked = rankRecommendations(params.founderProfile, params.founderAnalysis, params.resources)
      .slice(0, params.topN);

    const founderSummary = compactFounderSummary(params.founderProfile, params.founderAnalysis);

    const explained = await Promise.all(
      ranked.map(async (item) => {
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
