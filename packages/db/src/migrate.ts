import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbPool } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const migrationsDir = path.resolve(__dirname, "../sql/migrations");

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const applied = await dbPool.query("SELECT id FROM schema_migrations WHERE id = $1", [file]);
    if (applied.rowCount && applied.rowCount > 0) {
      continue;
    }

    const sqlPath = path.resolve(migrationsDir, file);
    const migrationSql = await readFile(sqlPath, "utf8");
    await dbPool.query("BEGIN");
    await dbPool.query(migrationSql);
    await dbPool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
    await dbPool.query("COMMIT");
    console.log(`Migration completed: ${file}`);
  }

  await dbPool.end();
}

run().catch(async (error) => {
  console.error(error);
  await dbPool.end();
  process.exit(1);
});
