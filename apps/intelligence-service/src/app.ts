import Fastify from "fastify";
import { Pool } from "pg";
import { AiService } from "../../../packages/ai/dist/index.js";
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

  const aiService = options.aiService ?? new AiService();

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
