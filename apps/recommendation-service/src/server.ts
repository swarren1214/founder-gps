import { buildApp } from "./app.js";
import { config } from "./config.js";

async function start() {
  const app = buildApp({
    databaseUrl: config.DATABASE_URL,
    resourceServiceUrl: config.RESOURCE_SERVICE_URL,
    intelligenceServiceUrl: config.INTELLIGENCE_SERVICE_URL,
    openAiApiKey: config.OPENAI_API_KEY,
    openAiBaseUrl: config.OPENAI_BASE_URL,
    openAiRecommendationModel: config.OPENAI_RECOMMENDATION_MODEL
  });

  await app.listen({ port: config.RECOMMENDATION_SERVICE_PORT, host: "0.0.0.0" });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
