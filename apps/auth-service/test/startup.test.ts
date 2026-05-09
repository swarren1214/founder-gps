import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureAuthSchema } from "../src/startup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("auth startup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes the auth schema migration before serving requests", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migrationPath = path.resolve(__dirname, "../../../packages/db/sql/migrations/010_auth.sql");
    const migrationSql = await fs.readFile(migrationPath, "utf8");

    await ensureAuthSchema({ query });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(migrationSql);
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS auth_sessions");
  });
});