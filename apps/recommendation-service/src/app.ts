import Fastify from "fastify";
import { Pool } from "pg";
import { HttpIntelligenceClient, type IntelligenceClient } from "./clients/intelligence-client.js";
import {
  OpenAiRecommendationClient,
  type LlmRecommendationClient
} from "./clients/openai-recommendation-client.js";
import { HttpResourceClient, type ResourceClient } from "./clients/resource-client.js";
import { recommendationRoutes } from "./routes/recommendations.js";
import {
  PgRecommendationRepository,
  type RecommendationRepository
} from "./repository.js";
import { RecommendationService } from "./service.js";

export type AppOptions = {
  databaseUrl?: string;
  resourceServiceUrl?: string;
  intelligenceServiceUrl?: string;
  resourceClient?: ResourceClient;
  intelligenceClient?: IntelligenceClient;
  llmRecommendationClient?: LlmRecommendationClient;
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  openAiRecommendationModel?: string;
  repository?: RecommendationRepository;
  service?: RecommendationService;
};

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true });

  const repository =
    options.repository ??
    new PgRecommendationRepository(
      new Pool({ connectionString: options.databaseUrl ?? process.env.DATABASE_URL })
    );

  const resourceClient =
    options.resourceClient ??
    new HttpResourceClient(options.resourceServiceUrl ?? process.env.RESOURCE_SERVICE_URL ?? "http://localhost:4001");

  const intelligenceClient =
    options.intelligenceClient ??
    new HttpIntelligenceClient(
      options.intelligenceServiceUrl ?? process.env.INTELLIGENCE_SERVICE_URL ?? "http://localhost:4003"
    );

  const llmRecommendationClient =
    options.llmRecommendationClient ??
    (options.openAiApiKey || process.env.OPENAI_API_KEY
      ? new OpenAiRecommendationClient({
          apiKey: options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? "",
          baseUrl: options.openAiBaseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
          model: options.openAiRecommendationModel ?? process.env.OPENAI_RECOMMENDATION_MODEL ?? "gpt-4o-mini"
        })
      : undefined);

  const service =
    options.service ??
    new RecommendationService(resourceClient, intelligenceClient, repository, llmRecommendationClient);

  app.get("/health", async () => ({ ok: true }));

  app.register(async (instance) => {
    await recommendationRoutes(instance, service, repository);
  });

  return app;
}
