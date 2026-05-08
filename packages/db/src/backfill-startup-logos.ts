import { dbPool } from "./client.js";

type BrandfetchFormat = {
  src: string;
  format?: string;
  width?: number;
};

type BrandfetchLogo = {
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
  const sources = (payload.logos ?? [])
    .flatMap((logo) => logo.formats ?? [])
    .filter((format) => typeof format.src === "string" && format.src.length > 0)
    .sort((a, b) => {
      const aRank = a.format === "svg" ? 0 : a.format === "png" ? 1 : 2;
      const bRank = b.format === "svg" ? 0 : b.format === "png" ? 1 : 2;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return (b.width ?? 0) - (a.width ?? 0);
    });

  return sources[0]?.src ?? null;
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
  }>(
    `
    SELECT id, name, website
    FROM startup_profiles
    WHERE website IS NOT NULL
      AND btrim(website) <> ''
      AND (logo_url IS NULL OR btrim(logo_url) = '')
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
