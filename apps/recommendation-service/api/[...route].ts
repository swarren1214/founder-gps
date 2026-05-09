import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

let appInstance: Awaited<ReturnType<typeof buildApp>> | null = null;

async function getApp() {
  if (!appInstance) {
    appInstance = buildApp({
      databaseUrl: process.env.DATABASE_URL,
      resourceServiceUrl: process.env.RESOURCE_SERVICE_URL,
      intelligenceServiceUrl: process.env.INTELLIGENCE_SERVICE_URL,
      openAiApiKey: process.env.OPENAI_API_KEY,
      openAiBaseUrl: process.env.OPENAI_BASE_URL,
      openAiRecommendationModel: process.env.OPENAI_RECOMMENDATION_MODEL
    });
    await appInstance.ready();
  }

  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}