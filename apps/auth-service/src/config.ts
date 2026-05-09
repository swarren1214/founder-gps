import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(serviceDir, "../../../.env");
const rootEnvResult = loadEnv({ path: rootEnvPath });
if (rootEnvResult.error) {
  loadEnv();
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SERVICE_PORT: z.coerce.number().default(4005),
  AUTH_COOKIE_NAME: z.string().min(1).default("fg_session"),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  AUTH_AVATAR_STORAGE_DIR: z.string().min(1).default(".data/avatars"),
  AUTH_AVATAR_PUBLIC_BASE_URL: z.string().url().default("http://localhost:4005/profile/avatar"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const config = parsed.data;
