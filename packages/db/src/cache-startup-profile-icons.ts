import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbPool } from "./client.js";

type StartupLogoRow = {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
};

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

const ALLOWED_EXTENSIONS = new Set(["svg", "png", "jpg", "jpeg", "webp", "avif"]);

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
    const pathName = parsed.pathname.toLowerCase();
    if (pathName.endsWith(".svg")) return "svg";
    if (pathName.endsWith(".png")) return "png";
    if (pathName.endsWith(".jpeg") || pathName.endsWith(".jpg")) return "jpeg";
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

function getOutputDirectory(): string {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../../../apps/web/public/startup-logos");
}

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) {
    return null;
  }

  const normalized = contentType.toLowerCase();
  if (normalized.includes("image/svg+xml")) return "svg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/jpeg") || normalized.includes("image/jpg")) return "jpg";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/avif")) return "avif";

  return null;
}

function extensionFromUrl(source: string): string | null {
  try {
    const parsed = new URL(source);
    const ext = path.extname(parsed.pathname).replace(".", "").toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
  } catch {
    return null;
  }
}

async function removeExistingIconFiles(outputDir: string, startupId: string): Promise<void> {
  const files = await readdir(outputDir);
  const prefix = `${startupId}.`;

  await Promise.all(
    files
      .filter((fileName) => fileName.startsWith(prefix))
      .map((fileName) => rm(path.join(outputDir, fileName), { force: true }))
  );
}

async function downloadIcon(source: string): Promise<{ bytes: Uint8Array; extension: string } | null> {
  try {
    const response = await fetch(source, {
      headers: { Accept: "image/*" },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type");
    const extension = extensionFromContentType(contentType) ?? extensionFromUrl(source) ?? "png";
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      return null;
    }

    return {
      bytes: new Uint8Array(arrayBuffer),
      extension
    };
  } catch {
    return null;
  }
}

function normalizeDomain(input: string | null): string | null {
  const trimmed = (input ?? "").trim();
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

function logoDevUrl(domain: string, size: number): string {
  const token = process.env.LOGO_DEV_API_KEY || process.env.LOGO_DEV_PUBLISHABLE_KEY || "";
  const url = new URL(`https://img.logo.dev/${domain}`);
  url.searchParams.set("size", String(size));
  url.searchParams.set("format", "png");
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

async function getBrandfetchLogoSource(
  domain: string,
  apiKey: string
): Promise<{ source: string | null; quotaExceeded: boolean }> {
  try {
    const response = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (response.status === 429) {
      return { source: null, quotaExceeded: true };
    }

    if (!response.ok) {
      return { source: null, quotaExceeded: false };
    }

    const payload = (await response.json()) as BrandfetchResponse;
    return { source: pickBrandfetchSource(payload), quotaExceeded: false };
  } catch {
    return { source: null, quotaExceeded: false };
  }
}

async function downloadFirst(
  sources: string[]
): Promise<{ bytes: Uint8Array; extension: string; source: string } | null> {
  for (const source of sources) {
    const downloaded = await downloadIcon(source);
    if (downloaded) {
      return { ...downloaded, source };
    }
  }

  return null;
}

async function run() {
  const outputDir = getOutputDirectory();
  await mkdir(outputDir, { recursive: true });

  const apiKey = process.env.BRANDFETCH_API_KEY ?? "";
  let brandfetchQuotaExceeded = false;

  const result = await dbPool.query<StartupLogoRow>(
    `
    SELECT id, name, website, logo_url
    FROM startup_profiles
    ORDER BY name ASC
    `
  );

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const existingLogo = row.logo_url?.trim() ?? "";

    const domain = normalizeDomain(row.website);
    const sourceCandidates: string[] = [];

    if (domain) {
      sourceCandidates.push(logoDevUrl(domain, 64));
    }

    if (existingLogo && !existingLogo.startsWith("/startup-logos/")) {
      sourceCandidates.push(existingLogo);
    }

    if (domain && apiKey && !brandfetchQuotaExceeded) {
      const brandfetch = await getBrandfetchLogoSource(domain, apiKey);
      if (brandfetch.quotaExceeded) {
        brandfetchQuotaExceeded = true;
      }
      if (brandfetch.source) {
        sourceCandidates.unshift(brandfetch.source);
      }
    }

    if (domain) {
      sourceCandidates.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
      sourceCandidates.push(`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`);
    }

    const downloaded = await downloadFirst(sourceCandidates);
    if (!downloaded) {
      skipped += 1;
      continue;
    }

    const extension = downloaded.extension === "jpeg" ? "jpg" : downloaded.extension;
    const fileName = `${row.id}.${extension}`;
    const relativePath = `/startup-logos/${fileName}`;
    const destination = path.join(outputDir, fileName);

    await removeExistingIconFiles(outputDir, row.id);
    await writeFile(destination, downloaded.bytes);

    await dbPool.query(
      `
      UPDATE startup_profiles
      SET logo_url = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [row.id, relativePath]
    );

    updated += 1;

    // Keep request rate controlled while downloading remote assets.
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  console.log(`Startup icon cache complete. Updated: ${updated}, Skipped: ${skipped}`);

  await dbPool.end();
}

run().catch(async (error) => {
  console.error(error);
  await dbPool.end();
  process.exit(1);
});
