import { z } from "zod";
import type { FounderAnalysis, FounderProfileInput, StartupResource } from "../types.js";

const llmResponseSchema = z.object({
  recommendations: z.array(
    z.object({
      resourceId: z.string().uuid(),
      reason: z.string().min(1),
      recommendedAction: z.string().min(1)
    })
  )
});

export interface LlmRecommendationClient {
  recommend(params: {
    founderProfile: FounderProfileInput;
    founderAnalysis: FounderAnalysis;
    resources: StartupResource[];
    topN: number;
  }): Promise<Array<{ resourceId: string; reason: string; recommendedAction: string }>>;
}

export class OpenAiRecommendationClient implements LlmRecommendationClient {
  constructor(
    private readonly config: {
      apiKey: string;
      baseUrl: string;
      model: string;
    }
  ) {}

  async recommend(params: {
    founderProfile: FounderProfileInput;
    founderAnalysis: FounderAnalysis;
    resources: StartupResource[];
    topN: number;
  }): Promise<Array<{ resourceId: string; reason: string; recommendedAction: string }>> {
    const trimmedResources = params.resources.slice(0, 60).map((resource) => ({
      id: resource.id,
      name: resource.name,
      category: resource.category,
      city: resource.city,
      stageFit: resource.stageFit,
      industryFit: resource.industryFit,
      tags: resource.tags,
      description: resource.description
    }));

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a startup resource recommendation engine. Return strict JSON only with recommendations that match the founder profile and analysis."
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "Select the best resources for this founder. Return at most topN recommendations in priority order with fields resourceId, reason, recommendedAction.",
              topN: params.topN,
              founderProfile: {
                stage: params.founderProfile.stage,
                city: params.founderProfile.location.city,
                idea: params.founderProfile.idea,
                industry: params.founderProfile.industry,
                challenge: params.founderProfile.challenge,
                fundingStatus: params.founderProfile.fundingStatus,
                background: params.founderProfile.background
              },
              founderAnalysis: {
                stage: params.founderAnalysis.stage,
                primaryNeeds: params.founderAnalysis.primaryNeeds,
                secondaryNeeds: params.founderAnalysis.secondaryNeeds,
                suggestedFocus: params.founderAnalysis.suggestedFocus,
                risks: params.founderAnalysis.risks
              },
              resources: trimmedResources
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "resource_recommendations",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["recommendations"],
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["resourceId", "reason", "recommendedAction"],
                    properties: {
                      resourceId: { type: "string" },
                      reason: { type: "string" },
                      recommendedAction: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI recommendation request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response was empty.");
    }

    const parsed = llmResponseSchema.parse(JSON.parse(content));

    const unique = new Set<string>();
    const recommendations = parsed.recommendations.filter((item) => {
      if (unique.has(item.resourceId)) {
        return false;
      }
      unique.add(item.resourceId);
      return true;
    });

    return recommendations.slice(0, params.topN);
  }
}
