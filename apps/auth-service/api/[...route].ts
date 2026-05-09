import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

let appInstance: Awaited<ReturnType<typeof buildApp>> | null = null;

async function getApp() {
  if (!appInstance) {
    appInstance = buildApp({
      databaseUrl: process.env.DATABASE_URL,
      cookieName: process.env.AUTH_COOKIE_NAME,
      sessionTtlDays: process.env.AUTH_SESSION_TTL_DAYS ? Number(process.env.AUTH_SESSION_TTL_DAYS) : undefined,
      isProduction: process.env.NODE_ENV === "production",
      avatarStorageDir: process.env.AUTH_AVATAR_STORAGE_DIR,
      avatarPublicBaseUrl: process.env.AUTH_AVATAR_PUBLIC_BASE_URL
    });
    await appInstance.ready();
  }

  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}