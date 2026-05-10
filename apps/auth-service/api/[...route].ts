import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.ts";

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
        cookieName: process.env.AUTH_COOKIE_NAME,
        sessionTtlDays: process.env.AUTH_SESSION_TTL_DAYS ? Number(process.env.AUTH_SESSION_TTL_DAYS) : undefined,
        isProduction: process.env.NODE_ENV === "production",
        avatarStorageDir: process.env.AUTH_AVATAR_STORAGE_DIR,
        avatarPublicBaseUrl: process.env.AUTH_AVATAR_PUBLIC_BASE_URL
      });
      await appInstance.ready();
    } catch (error) {
      appInitializationError = error instanceof Error ? error : new Error("Failed to initialize auth service");
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
    console.error("Auth service initialization failed", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "SERVICE_INITIALIZATION_FAILED", message }));
  }
}