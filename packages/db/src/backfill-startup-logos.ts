import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbPool } from "./client.js";

type BrandfetchFormat = {
  src: string;
  format?: string;
  width?: number;
  height?: number;
};

type BrandfetchLogo = {
  type?: string;
  formats?: BrandfetchFormat[];
};

type BrandfetchResponse = {
  logos?: BrandfetchLogo[];
};

type BrandfetchCandidate = {
  logoType: string;
  format: BrandfetchFormat;
};

function normalizeBrandfetchFormat(value?: string): "svg" | "png" | "jpeg" | "other" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpeg";
  return "other";
}

function inferFormatFromSrc(src: string): "svg" | "png" | "jpeg" | "other" {
  try {
    const parsed = new URL(src);
    const path = parsed.pathname.toLowerCase();
    if (path.endsWith(".svg")) return "svg";
    if (path.endsWith(".png")) return "png";
    if (path.endsWith(".jpeg") || path.endsWith(".jpg")) return "jpeg";
  } catch {
    // noop
  }
  return "other";
}

function formatRank(candidate: BrandfetchCandidate): number {
  const fromFormat = normalizeBrandfetchFormat(candidate.format.format);
  const inferred = inferFormatFromSrc(candidate.format.src);
  const normalized = fromFormat === "other" ? inferred : fromFormat;

  if (normalized === "svg") return 0;
  if (normalized === "png") return 1;
  if (normalized === "jpeg") return 2;
  return 3;
}

function pickBrandfetchSource(payload: BrandfetchResponse): string | null {
  const allCandidates: BrandfetchCandidate[] = (payload.logos ?? [])
    .flatMap((logo) =>
      (logo.formats ?? []).map((format) => ({
        logoType: logo.type ?? "",
        format
      }))
    )
    .filter((entry) => typeof entry.format.src === "string" && entry.format.src.length > 0);

  const iconCandidates = allCandidates.filter((entry) => entry.logoType.toLowerCase() === "icon");
  const fallbackCandidates = allCandidates.filter((entry) => entry.logoType.toLowerCase() !== "icon");
  const candidatePool = iconCandidates.length > 0 ? iconCandidates : fallbackCandidates;

  candidatePool.sort((a, b) => {
    const rankDiff = formatRank(a) - formatRank(b);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const aWidth = a.format.width ?? 0;
    const bWidth = b.format.width ?? 0;
    if (aWidth !== bWidth) {
      return bWidth - aWidth;
    }

    const aHeight = a.format.height ?? 0;
    const bHeight = b.format.height ?? 0;
    return bHeight - aHeight;
  });

  return candidatePool[0]?.format.src ?? null;
}

function extractBrandfetchBase(source: string): { base: string; query: string } | null {
  try {
    const parsed = new URL(source);
    if (parsed.hostname !== "cdn.brandfetch.io") {
      return null;
    }

    const path = parsed.pathname;
    const marker = path.match(/\/(logo|icon)\.(svg|png|jpe?g)$/i);
    if (!marker || marker.index === undefined) {
      return null;
    }

    const basePath = path.slice(0, marker.index + 1);
    return {
      base: `${parsed.origin}${basePath}`,
      query: parsed.search
    };
  } catch {
    return null;
  }
}

async function probeImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "image/*" },
      cache: "no-store"
    });
    const contentType = response.headers.get("content-type") || "";
    return response.ok && contentType.startsWith("image/");
  } catch {
    return false;
  }
}

async function getBrandfetchSourceFromExisting(existingSource: string | null): Promise<string | null> {
  if (!existingSource) {
    return null;
  }

  const parsed = extractBrandfetchBase(existingSource);
  if (!parsed) {
    return null;
  }

  const formats = ["svg", "png", "jpeg", "jpg"];
  const candidates: string[] = [];

  for (const format of formats) {
    candidates.push(`${parsed.base}icon.${format}${parsed.query}`);
  }

  for (const format of formats) {
    candidates.push(`${parsed.base}logo.${format}${parsed.query}`);
  }

  for (const candidate of candidates) {
    if (await probeImage(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function logoDevUrl(domain: string): string {
  const token = process.env.LOGO_DEV_API_KEY || process.env.LOGO_DEV_PUBLISHABLE_KEY || "";
  const url = new URL(`https://img.logo.dev/${domain}`);
  url.searchParams.set("size", "128");
  url.searchParams.set("format", "png");
  url.searchParams.set("fallback", "404");
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

function getOutputDirectory(): string {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../../../apps/web/public/startup-logos");
}

async function removeExistingIconFiles(outputDir: string, startupId: string): Promise<void> {
  try {
    const files = await readdir(outputDir);
    const prefix = `${startupId}.`;

    await Promise.all(
      files
        .filter((fileName) => fileName.startsWith(prefix))
        .map((fileName) => rm(path.join(outputDir, fileName), { force: true }))
    );
  } catch {
    // Ignore missing directory and continue backfill updates.
  }
}

async function getBrandfetchLogoSource(domain: string, apiKey: string): Promise<string | null> {
  const response = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as BrandfetchResponse;
  return pickBrandfetchSource(payload);
}

async function run() {
  const apiKey = process.env.BRANDFETCH_API_KEY;
  const outputDir = getOutputDirectory();

  const result = await dbPool.query<{
    id: string;
    name: string;
    website: string | null;
    logo_url: string | null;
  }>(
    `
    SELECT id, name, website, logo_url
    FROM startup_profiles
    WHERE website IS NOT NULL
      AND btrim(website) <> ''
    ORDER BY name ASC
    `
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of result.rows) {
    const domain = row.website ? normalizeDomain(row.website) : null;

    if (!domain) {
      skipped += 1;
      continue;
    }

    try {
      let logoSource: string | null = null;

      const preferredLogoDev = logoDevUrl(domain);
      if (await probeImage(preferredLogoDev)) {
        logoSource = preferredLogoDev;
      }

      if (!logoSource && apiKey) {
        logoSource =
          (await getBrandfetchLogoSource(domain, apiKey)) ||
          (await getBrandfetchSourceFromExisting(row.logo_url));
      }

      if (!logoSource) {
        skipped += 1;
        continue;
      }

      const existingLogo = row.logo_url?.trim() ?? "";
      if (existingLogo && existingLogo === logoSource) {
        skipped += 1;
        continue;
      }

      if (existingLogo.startsWith("/startup-logos/")) {
        await removeExistingIconFiles(outputDir, row.id);
      }

      await dbPool.query(
        `
        UPDATE startup_profiles
        SET logo_url = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [row.id, logoSource]
      );

      updated += 1;
    } catch {
      failed += 1;
    }

    // Soft throttle to avoid API rate spikes during backfill.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  console.log(`Startup logo backfill complete. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);

  await dbPool.end();
}

run().catch(async (error) => {
  console.error(error);
  await dbPool.end();
  process.exit(1);
});
