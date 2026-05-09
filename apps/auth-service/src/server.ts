import { buildApp } from "./app.js";
import { config } from "./config.js";

async function start() {
  const app = buildApp({
    databaseUrl: config.DATABASE_URL,
    cookieName: config.AUTH_COOKIE_NAME,
    sessionTtlDays: config.AUTH_SESSION_TTL_DAYS,
    isProduction: config.NODE_ENV === "production",
    avatarStorageDir: config.AUTH_AVATAR_STORAGE_DIR,
    avatarPublicBaseUrl: config.AUTH_AVATAR_PUBLIC_BASE_URL
  });

  await app.listen({ port: config.AUTH_SERVICE_PORT, host: "0.0.0.0" });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
