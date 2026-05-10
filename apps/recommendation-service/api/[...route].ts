import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

let appInstance: Awaited<ReturnType<typeof buildApp>> | null = null;
let appInitializationError: Error | null = null;

async function getApp() {
  if (appInitializationError) {
    throw appInitializationError;
  }

  if (!appInstance) {
    try {
      appInstance = buildApp({
        databaseUrl: process.env.DATABASE_URL,
        resourceServiceUrl: process.env.RESOURCE_SERVICE_URL,
        intelligenceServiceUrl: process.env.INTELLIGENCE_SERVICE_URL,
        openAiApiKey: process.env.OPENAI_API_KEY,
        openAiBaseUrl: process.env.OPENAI_BASE_URL,
        openAiRecommendationModel: process.env.OPENAI_RECOMMENDATION_MODEL
      });
      await appInstance.ready();
    } catch (error) {
      appInitializationError =
        error instanceof Error ? error : new Error("Failed to initialize recommendation service");
      throw appInitializationError;
    }
  }

  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app.server.emit("request", req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown initialization failure";
    console.error("Recommendation service initialization failed", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "SERVICE_INITIALIZATION_FAILED", message }));
  }
}