import { AiService } from "@founder-gps/ai";
import { buildApp } from "./app.js";
import { config } from "./config.js";

async function start() {
  const app = buildApp({
    databaseUrl: config.DATABASE_URL,
    aiService: new AiService({
      provider: config.AI_PROVIDER,
      openAiApiKey: config.OPENAI_API_KEY,
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
