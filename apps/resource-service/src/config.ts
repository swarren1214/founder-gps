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
  RESOURCE_SERVICE_PORT: z.coerce.number().default(4001)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const config = parsed.data;
