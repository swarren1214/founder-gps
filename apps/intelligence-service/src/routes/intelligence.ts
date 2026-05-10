import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AiService,
  ExplainRecommendationInputSchema,
  FounderAnalysisInputSchema,
  RoadmapInputSchema,
  MapChatInputSchema
} from "../../../../packages/ai/dist/index.js";
import { sendApiError } from "../../../../packages/shared-types/dist/index.js";
import type { IntelligenceRepository } from "../repository.js";
import { chatRoutes } from "./chat.js";

function logMetadata(app: FastifyInstance, route: string, metadata: Record<string, unknown>) {
  app.log.info({ route, ...metadata }, "ai_call_complete");
}

export async function intelligenceRoutes(
  app: FastifyInstance,
  repository: IntelligenceRepository,
  aiService: AiService,
  options: { resourceServiceUrl: string; recommendationServiceUrl: string; fetchImpl?: typeof fetch }
) {
  await chatRoutes(app, repository, aiService, {
    resourceServiceUrl: options.resourceServiceUrl,
    recommendationServiceUrl: options.recommendationServiceUrl,
    fetchImpl: options.fetchImpl
  });

  app.post("/intelligence/analyze-founder", async (request, reply) => {
    const parsed = FounderAnalysisInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid analyze-founder request.", parsed.error.flatten());
    }

    try {
      const result = await aiService.analyzeFounder(parsed.data);
      const snapshot = await repository.saveFounderAnalysisSnapshot({
        founderProfileId: parsed.data.founderProfileId,
        analysis: result.data,
        metadata: result.metadata
      });

      logMetadata(app, "/intelligence/analyze-founder", {
        provider: result.metadata.provider,
        model: result.metadata.model,
        promptVersion: result.metadata.promptVersion,
        latencyMs: result.metadata.latencyMs,
        tokensIn: result.metadata.tokensIn,
        tokensOut: result.metadata.tokensOut,
        fallbackUsed: result.metadata.fallbackUsed,
        snapshotId: snapshot.id
      });

      return reply.send({
        analysis: result.data,
        snapshotId: snapshot.id,
        metadata: result.metadata
      });
    } catch (error) {
      app.log.error({ error }, "analyze_founder_failed");
      return sendApiError(
        reply,
        "DEPENDENCY_UNAVAILABLE",
        "Intelligence dependency unavailable. Analysis generation or snapshot persistence failed."
      );
    }
  });

  app.post("/intelligence/explain-recommendation", async (request, reply) => {
    const parsed = ExplainRecommendationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(
        reply,
        "VALIDATION_ERROR",
        "Invalid explain-recommendation request.",
        parsed.error.flatten()
      );
    }

    try {
      const result = await aiService.explainRecommendation(parsed.data);
      logMetadata(app, "/intelligence/explain-recommendation", {
        provider: result.metadata.provider,
        model: result.metadata.model,
        promptVersion: result.metadata.promptVersion,
        latencyMs: result.metadata.latencyMs,
        tokensIn: result.metadata.tokensIn,
        tokensOut: result.metadata.tokensOut,
        fallbackUsed: result.metadata.fallbackUsed
      });

      return reply.send({
        explanation: result.data,
        metadata: result.metadata
      });
    } catch (error) {
      app.log.error({ error }, "explain_recommendation_failed");
      return sendApiError(
        reply,
        "DEPENDENCY_UNAVAILABLE",
        "AI provider unavailable. Unable to generate recommendation explanation."
      );
    }
  });

  app.post("/intelligence/generate-roadmap", async (request, reply) => {
    const parsed = RoadmapInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid generate-roadmap request.", parsed.error.flatten());
    }

    try {
      const result = await aiService.generateRoadmap(parsed.data);
      logMetadata(app, "/intelligence/generate-roadmap", {
        provider: result.metadata.provider,
        model: result.metadata.model,
        promptVersion: result.metadata.promptVersion,
        latencyMs: result.metadata.latencyMs,
        tokensIn: result.metadata.tokensIn,
        tokensOut: result.metadata.tokensOut,
        fallbackUsed: result.metadata.fallbackUsed
      });

      return reply.send({
        roadmap: result.data,
        metadata: result.metadata
      });
    } catch (error) {
      app.log.error({ error }, "generate_roadmap_failed");
      return sendApiError(
        reply,
        "DEPENDENCY_UNAVAILABLE",
        "AI provider unavailable. Unable to generate roadmap."
      );
    }
  });

  app.post("/intelligence/map-chat", async (request, reply) => {
    const parsed = MapChatInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid map-chat request.", parsed.error.flatten());
    }

    try {
      const result = await aiService.chatWithMap(parsed.data);
      logMetadata(app, "/intelligence/map-chat", {
        provider: result.metadata.provider,
        model: result.metadata.model,
        promptVersion: result.metadata.promptVersion,
        latencyMs: result.metadata.latencyMs,
        tokensIn: result.metadata.tokensIn,
        tokensOut: result.metadata.tokensOut,
        fallbackUsed: result.metadata.fallbackUsed
      });

      return reply.send({
        filters: result.data,
        metadata: result.metadata
      });
    } catch (error) {
      app.log.error({ error }, "map_chat_failed");
      return sendApiError(
        reply,
        "DEPENDENCY_UNAVAILABLE",
        "AI provider unavailable. Unable to process map chat."
      );
    }
  });

  app.get("/intelligence/analysis/:snapshotId", async (request, reply) => {
    const snapshotSchema = z.object({ snapshotId: z.string().uuid() });
    const parsed = snapshotSchema.safeParse(request.params);

    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid analysis snapshot id.", parsed.error.flatten());
    }

    const snapshot = await repository.getFounderAnalysisSnapshot(parsed.data.snapshotId);
    if (!snapshot) {
      return sendApiError(reply, "NOT_FOUND", "Analysis snapshot not found.");
    }

    return reply.send(snapshot);
  });
}
