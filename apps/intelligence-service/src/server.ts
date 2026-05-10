import { AiService } from "../../../packages/ai/dist/index.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";

async function start() {
  const app = buildApp({
    databaseUrl: config.DATABASE_URL,
    resourceServiceUrl: config.RESOURCE_SERVICE_URL,
    recommendationServiceUrl: config.RECOMMENDATION_SERVICE_URL,
    aiService: new AiService({
      provider: config.AI_PROVIDER,
      openAiApiKey: config.OPENAI_API_KEY,
      openAiBaseUrl: config.OPENAI_BASE_URL,
      geminiApiKey: config.GEMINI_API_KEY,
      model: config.AI_MODEL
    })
  });

  await app.listen({ port: config.INTELLIGENCE_SERVICE_PORT, host: "0.0.0.0" });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
