import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyOsrmArtifacts } from "../src/startup-checks.js";

const requiredSuffixes = [
  "",
  ".cells",
  ".cell_metrics",
  ".mldgr",
  ".partition",
  ".names",
  ".geometry",
  ".datasource_names"
];

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("OSRM startup checks", () => {
  it("passes when required MLD artifacts exist", async () => {
    const dir = await mkdir(path.join(os.tmpdir(), `founder-gps-osrm-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(dir);

    await Promise.all(
      requiredSuffixes.map((suffix) => writeFile(path.join(dir, `utah-latest.osrm${suffix}`), ""))
    );

    await expect(verifyOsrmArtifacts(dir, "utah-latest.osrm")).resolves.toBeUndefined();
  });

  it("fails when a required artifact is missing", async () => {
    const dir = await mkdir(path.join(os.tmpdir(), `founder-gps-osrm-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(dir);

    await writeFile(path.join(dir, "utah-latest.osrm"), "");

    await expect(verifyOsrmArtifacts(dir, "utah-latest.osrm")).rejects.toThrow(
      /Missing OSRM artifacts/
    );
  });
});
