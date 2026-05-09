import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

let appInstance: Awaited<ReturnType<typeof buildApp>> | null = null;

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function getApp() {
  if (!appInstance) {
    appInstance = buildApp({
      osrmBaseUrl: process.env.OSRM_BASE_URL,
      osrmRequestTimeoutMs: parseNumber(process.env.OSRM_REQUEST_TIMEOUT_MS),
      osrmMaxRetries: parseNumber(process.env.OSRM_MAX_RETRIES)
    });
    await appInstance.ready();
  }

  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}