import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  RECOMMENDATION_SERVICE_PORT: z.coerce.number().default(4004),
  RESOURCE_SERVICE_URL: z.string().url().default("http://localhost:4001"),
  INTELLIGENCE_SERVICE_URL: z.string().url().default("http://localhost:4003")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const config = parsed.data;
