import { access } from "node:fs/promises";
import path from "node:path";

const MLD_REQUIRED_SUFFIXES = [
  "",
  ".cells",
  ".cell_metrics",
  ".mldgr",
  ".partition",
  ".names",
  ".geometry",
  ".datasource_names"
] as const;

export async function verifyOsrmArtifacts(dataPath: string, basename: string): Promise<void> {
  const missing: string[] = [];

  for (const suffix of MLD_REQUIRED_SUFFIXES) {
    const filePath = path.join(dataPath, `${basename}${suffix}`);
    try {
      await access(filePath);
    } catch {
      missing.push(filePath);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing OSRM artifacts for ${basename}. Expected files: ${missing.join(", ")}`
    );
  }
}
