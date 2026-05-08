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
  const candidates = (payload.logos ?? [])
    .flatMap((logo) =>
      (logo.formats ?? []).map((format) => ({
        logoType: logo.type ?? "",
        format
      }))
    )
    .filter((entry) => typeof entry.format.src === "string" && entry.format.src.length > 0)
    .sort((a, b) => {
      const aIsIcon = a.logoType.toLowerCase() === "icon" ? 0 : 1;
      const bIsIcon = b.logoType.toLowerCase() === "icon" ? 0 : 1;
      if (aIsIcon !== bIsIcon) {
        return aIsIcon - bIsIcon;
      }

      const aRatio =
        typeof a.format.width === "number" && typeof a.format.height === "number" && a.format.height > 0
          ? Math.abs(1 - a.format.width / a.format.height)
          : Number.POSITIVE_INFINITY;
      const bRatio =
        typeof b.format.width === "number" && typeof b.format.height === "number" && b.format.height > 0
          ? Math.abs(1 - b.format.width / b.format.height)
          : Number.POSITIVE_INFINITY;
      if (aRatio !== bRatio) {
        return aRatio - bRatio;
      }

      const aFormatRank = a.format.format === "svg" ? 0 : a.format.format === "png" ? 1 : 2;
      const bFormatRank = b.format.format === "svg" ? 0 : b.format.format === "png" ? 1 : 2;
      if (aFormatRank !== bFormatRank) {
        return aFormatRank - bFormatRank;
      }

      return (b.format.width ?? 0) - (a.format.width ?? 0);
    });

  return candidates[0]?.format.src ?? null;
}

async function run() {
  const apiKey = process.env.BRANDFETCH_API_KEY;

  if (!apiKey) {
    throw new Error("BRANDFETCH_API_KEY is required.");
  }

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

  for (const row of result.rows) {
    const domain = row.website ? normalizeDomain(row.website) : null;

    if (!domain) {
      skipped += 1;
      continue;
    }

    try {
      const logoSource = await getBrandfetchLogoSource(domain, apiKey);

      if (!logoSource) {
        skipped += 1;
        continue;
      }

      const existingLogo = row.logo_url?.trim() ?? "";
      if (existingLogo && existingLogo === logoSource) {
        skipped += 1;
        continue;
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
      skipped += 1;
    }

    // Soft throttle to avoid API rate spikes during backfill.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  console.log(`Startup logo backfill complete. Updated: ${updated}, Skipped: ${skipped}`);

  await dbPool.end();
}

run().catch(async (error) => {
  console.error(error);
  await dbPool.end();
  process.exit(1);
});
