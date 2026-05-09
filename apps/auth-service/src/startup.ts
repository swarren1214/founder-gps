import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_SCHEMA_MIGRATION_PATH = path.resolve(
  __dirname,
  "../../../packages/db/sql/migrations/010_auth.sql"
);

export async function ensureAuthSchema(pool: Pick<Pool, "query">): Promise<void> {
  const migrationSql = await readFile(AUTH_SCHEMA_MIGRATION_PATH, "utf8");
  await pool.query(migrationSql);
}