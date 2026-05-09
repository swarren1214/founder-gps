import { mkdir, readdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceDir = path.join(repoRoot, "packages", "db", "sql", "migrations");
const targetDir = path.join(repoRoot, "supabase", "migrations");

function getTimestampPrefix(offset = 0) {
  const now = new Date(Date.now() + offset * 1000);
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function normalizeMigrationSort(name) {
  const match = name.match(/^(\d+)_/);
  const order = match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  return { order, name };
}

async function main() {
  await mkdir(targetDir, { recursive: true });

  const [sourceEntries, targetEntries] = await Promise.all([
    readdir(sourceDir),
    readdir(targetDir)
  ]);

  const sourceMigrations = sourceEntries
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => {
      const left = normalizeMigrationSort(a);
      const right = normalizeMigrationSort(b);
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.name.localeCompare(right.name);
    });

  const existingByBaseName = new Set(
    targetEntries
      .filter((name) => name.endsWith(".sql"))
      .map((name) => {
        const separatorIndex = name.indexOf("_");
        return separatorIndex >= 0 ? name.slice(separatorIndex + 1) : name;
      })
  );

  let copiedCount = 0;
  let offset = 0;

  for (const fileName of sourceMigrations) {
    if (existingByBaseName.has(fileName)) {
      continue;
    }

    const timestamp = getTimestampPrefix(offset);
    const targetName = `${timestamp}_${fileName}`;

    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, targetName);

    await copyFile(sourcePath, targetPath);
    existingByBaseName.add(fileName);

    copiedCount += 1;
    offset += 1;

    console.log(`synced: ${targetName}`);
  }

  if (copiedCount === 0) {
    console.log("No new migrations to sync.");
    return;
  }

  console.log(`Synced ${copiedCount} migration${copiedCount === 1 ? "" : "s"} to supabase/migrations.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
