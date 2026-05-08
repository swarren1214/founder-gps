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
  ROUTING_SERVICE_PORT: z.coerce.number().default(4002),
  OSRM_BASE_URL: z.string().url().default("http://localhost:5000"),
  OSRM_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  OSRM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  OSRM_DATA_PATH: z.string().min(1).default(
    process.env.HOME
      ? `${process.env.HOME}/Developer/opswift/monorepo/osrm-data`
      : "/Developer/opswift/monorepo/osrm-data"
  ),
  OSRM_DATA_BASENAME: z.string().min(1).default("utah-latest.osrm")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const config = parsed.data;
