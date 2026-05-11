import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError } from "@founder-gps/shared-types";
import {
  GenerateRecommendationsRequestSchema,
  RankRecommendationsRequestSchema
} from "../types.js";
import type { RecommendationRepository } from "../repository.js";
import type { RecommendationService } from "../service.js";

export async function recommendationRoutes(
  app: FastifyInstance,
  service: RecommendationService,
  repository: RecommendationRepository
) {
  app.post("/recommendations/generate", async (request, reply) => {
    const parsed = GenerateRecommendationsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid recommendations generate request.", parsed.error.flatten());
    }

    const recommendations = await service.generate(parsed.data);
    return reply.send({ recommendations, count: recommendations.length });
  });

  app.post("/recommendations/rank", async (request, reply) => {
    const parsed = RankRecommendationsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid recommendations rank request.", parsed.error.flatten());
    }

    const recommendations = await service.rank({
      founderProfile: parsed.data.founderProfile,
      founderAnalysis: parsed.data.founderAnalysis,
      resources: parsed.data.resources,
      startups: parsed.data.startups,
      topN: parsed.data.topN
    });

    return reply.send({ recommendations, count: recommendations.length });
  });

  app.get("/recommendations/replay/:founderProfileId", async (request, reply) => {
    const parsed = z.object({ founderProfileId: z.string().uuid() }).safeParse(request.params);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid founder profile id.", parsed.error.flatten());
    }

    const recommendations = await repository.getRecommendationsByFounderProfile(
      parsed.data.founderProfileId
    );

    return reply.send({ recommendations, count: recommendations.length });
  });
}
