import { Pool } from "pg";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { PgAuthRepository } from "./repository.js";
import { ensureAuthSchema } from "./startup.js";

async function start() {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  await ensureAuthSchema(pool);

  const app = buildApp({
    repository: new PgAuthRepository(pool),
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
