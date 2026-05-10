import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

let appInstance: Awaited<ReturnType<typeof buildApp>> | null = null;
let appInitializationError: Error | null = null;

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function getApp() {
  if (appInitializationError) {
    throw appInitializationError;
  }

  if (!appInstance) {
    try {
      appInstance = buildApp({
        osrmBaseUrl: process.env.OSRM_BASE_URL,
        osrmRequestTimeoutMs: parseNumber(process.env.OSRM_REQUEST_TIMEOUT_MS),
        osrmMaxRetries: parseNumber(process.env.OSRM_MAX_RETRIES)
      });
      await appInstance.ready();
    } catch (error) {
      appInitializationError = error instanceof Error ? error : new Error("Failed to initialize routing service");
      throw appInitializationError;
    }
  }

  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const originalUrl = req.url ?? "/";
    req.url = originalUrl.replace(/^\/api(?=\/|$)/, "") || "/";
    const app = await getApp();
    app.server.emit("request", req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown initialization failure";
    console.error("Routing service initialization failed", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "SERVICE_INITIALIZATION_FAILED", message }));
  }
}