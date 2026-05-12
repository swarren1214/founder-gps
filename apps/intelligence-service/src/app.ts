import Fastify from "fastify";
import { Pool } from "pg";
import { AiService } from "@founder-gps/ai";
import { intelligenceRoutes } from "./routes/intelligence.js";
import {
  PgIntelligenceRepository,
  type IntelligenceRepository
} from "./repository.js";

export type AppOptions = {
  repository?: IntelligenceRepository;
  aiService?: AiService;
  databaseUrl?: string;
  resourceServiceUrl?: string;
  recommendationServiceUrl?: string;
  fetchImpl?: typeof fetch;
};

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true });

  const repository =
    options.repository ??
    new PgIntelligenceRepository(
      new Pool({
        connectionString: options.databaseUrl ?? process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      })
    );

  const aiService =
    options.aiService ??
    new AiService({
      provider: (process.env.AI_PROVIDER as "openai" | "gemini" | "heuristic" | undefined) ?? "heuristic",
      openAiApiKey: process.env.OPENAI_API_KEY,
      openAiBaseUrl: process.env.OPENAI_BASE_URL,
      geminiApiKey: process.env.GEMINI_API_KEY,
      model: process.env.AI_MODEL
    });

  app.get("/health", async () => ({ ok: true }));

  app.register(async (instance) => {
    await intelligenceRoutes(instance, repository, aiService, {
      resourceServiceUrl: options.resourceServiceUrl ?? process.env.RESOURCE_SERVICE_URL ?? "http://localhost:4001",
      recommendationServiceUrl:
        options.recommendationServiceUrl ?? process.env.RECOMMENDATION_SERVICE_URL ?? "http://localhost:4004",
      fetchImpl: options.fetchImpl
    });
  });

  return app;
}
