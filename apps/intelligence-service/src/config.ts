import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  INTELLIGENCE_SERVICE_PORT: z.coerce.number().default(4003),
  AI_PROVIDER: z.enum(["heuristic", "openai", "gemini"]).default("heuristic"),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("heuristic-v1")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const config = parsed.data;
