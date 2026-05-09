import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

let appInstance: Awaited<ReturnType<typeof buildApp>> | null = null;

async function getApp() {
  if (!appInstance) {
    appInstance = buildApp({
      databaseUrl: process.env.DATABASE_URL,
      resourceServiceUrl: process.env.RESOURCE_SERVICE_URL,
      recommendationServiceUrl: process.env.RECOMMENDATION_SERVICE_URL
    });
    await appInstance.ready();
  }

  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}