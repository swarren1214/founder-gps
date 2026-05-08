import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbPool } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const seedsDir = path.resolve(__dirname, "../sql/seeds");
  const seedFiles = (await readdir(seedsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of seedFiles) {
    const sqlPath = path.resolve(seedsDir, file);
    const seedSql = await readFile(sqlPath, "utf8");
    await dbPool.query(seedSql);
    console.log(`Seed completed: ${file}`);
  }

  await dbPool.end();
}

run().catch(async (error) => {
  console.error(error);
  await dbPool.end();
  process.exit(1);
});
