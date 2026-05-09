import { dbPool } from "./client.js";

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

async function run() {
  const result = await dbPool.query<{
    id: string;
    website: string | null;
  }>(
    `
    SELECT id, website
    FROM startup_profiles
    WHERE website IS NOT NULL
      AND btrim(website) <> ''
    ORDER BY id ASC
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
      const logoSource = logoDevUrl(domain);
      if (!(await probeImage(logoSource))) {
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
      failed += 1;
    }

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
