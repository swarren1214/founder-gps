import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AiService, ChatOutputSchema } from "@founder-gps/ai";
import { sendApiError } from "@founder-gps/shared-types";
import { z } from "zod";
import type { IntelligenceRepository } from "../repository.js";
import { buildContextBundle } from "../context-adapter.js";

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().uuid(),
  message: z.string().min(1),
  stylePrefs: z
    .object({
      tone: z.enum(["concise", "encouraging", "strategic", "technical"]),
      emojiMode: z.enum(["off", "light", "expressive"]),
      verbosity: z.enum(["short", "standard", "deep dive"])
    })
    .optional()
});

const chatSessionQuerySchema = z.object({
  userId: z.string().uuid()
});

type ChatRouteOptions = {
  resourceServiceUrl: string;
  recommendationServiceUrl: string;
  fetchImpl?: typeof fetch;
};

function logMetadata(app: FastifyInstance, route: string, metadata: Record<string, unknown>) {
  app.log.info({ route, ...metadata }, "ai_call_complete");
}

export async function chatRoutes(
  app: FastifyInstance,
  repository: IntelligenceRepository,
  aiService: AiService,
  options: ChatRouteOptions
) {
  app.post("/intelligence/chat", async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Invalid chat request.", parsed.error.flatten());
    }

    try {
      const session = await repository.createChatSession({ id: parsed.data.sessionId, userId: parsed.data.userId });
      const context = await buildContextBundle(
        {
          sessionId: session.id,
          userId: parsed.data.userId,
          message: parsed.data.message,
          stylePrefs: parsed.data.stylePrefs
        },
        {
          repository,
          resourceServiceUrl: options.resourceServiceUrl,
          recommendationServiceUrl: options.recommendationServiceUrl,
          fetchImpl: options.fetchImpl
        }
      );

      const contextSnapshot = await repository.saveChatContextSnapshot({
        sessionId: session.id,
        bundleHash: crypto.createHash("sha256").update(JSON.stringify(context)).digest("hex"),
        bundleJson: context
      });

      await repository.appendChatMessage({
        sessionId: session.id,
        role: "user",
        content: parsed.data.message,
        citations: [],
        toolInvocations: []
      });

      const result = await aiService.chat({
        sessionId: session.id,
        userId: parsed.data.userId,
        message: parsed.data.message,
        stylePrefs: parsed.data.stylePrefs,
        context
      });

      const validated = ChatOutputSchema.parse(result.data);

      await repository.appendChatMessage({
        sessionId: session.id,
        role: "assistant",
        content: validated.responseMarkdown,
        citations: validated.citations,
        toolInvocations: []
      });

      logMetadata(app, "/intelligence/chat", {
        provider: result.metadata.provider,
        model: result.metadata.model,
        promptVersion: result.metadata.promptVersion,
        latencyMs: result.metadata.latencyMs,
        tokensIn: result.metadata.tokensIn,
        tokensOut: result.metadata.tokensOut,
        fallbackUsed: result.metadata.fallbackUsed,
        sessionId: session.id,
        contextSnapshotId: contextSnapshot.id
      });

      return reply.send({
        ...validated,
        metadata: result.metadata,
        sessionId: session.id,
        contextSummary: context.conversationSummary
      });
    } catch (error) {
      app.log.error({ error }, "chat_failed");
      return sendApiError(reply, "DEPENDENCY_UNAVAILABLE", "AI chat dependency unavailable.");
    }
  });

  app.get("/intelligence/chat/session/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    if (!params.id) {
      return sendApiError(reply, "VALIDATION_ERROR", "Missing chat session id.");
    }

    const parsedQuery = chatSessionQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return sendApiError(reply, "VALIDATION_ERROR", "Missing or invalid user id.", parsedQuery.error.flatten());
    }

    const session = await repository.getChatSession(params.id);
    if (!session) {
      return sendApiError(reply, "NOT_FOUND", "Chat session not found.");
    }

    if (session.userId !== parsedQuery.data.userId) {
      return sendApiError(reply, "UNAUTHORIZED", "Session access denied.");
    }

    const messages = await repository.getChatMessages(params.id);
    const snapshots = await repository.getChatContextSnapshots(params.id);

    return reply.send({
      session,
      messages,
      snapshots,
      messageCount: messages.length,
      snapshotCount: snapshots.length
    });
  });
}
