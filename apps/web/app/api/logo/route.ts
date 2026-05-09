import { NextRequest, NextResponse } from "next/server";

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

async function getBrandfetchSourceFromExisting(sourceUrl: string | null): Promise<string | null> {
  if (!sourceUrl) {
    return null;
  }

  const parsed = extractBrandfetchBase(sourceUrl);
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

function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  return parsed.hostname.replace(/^www\./, "").toLowerCase();
}

function normalizeSourceUrl(input: string): string {
  const trimmed = input.trim();
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("invalid protocol");
  }
  return parsed.toString();
}

function logoDevUrl(domain: string, size: number): string {
  const token = process.env.LOGO_DEV_API_KEY || process.env.LOGO_DEV_PUBLISHABLE_KEY || "";
  const url = new URL(`https://img.logo.dev/${domain}`);
  url.searchParams.set("size", String(size));
  url.searchParams.set("format", "png");
  url.searchParams.set("fallback", "404");
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

async function fetchLogoDev(domain: string, size: number): Promise<Response | null> {
  const response = await fetch(logoDevUrl(domain, size), {
    headers: { Accept: "image/*" },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    return null;
  }

  return response;
}

async function getBrandfetchLogoSource(domain: string): Promise<string | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY;
  if (!apiKey) {
    return null;
  }

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

async function fetchBrandfetch(domain: string): Promise<Response | null> {
  const source = await getBrandfetchLogoSource(domain);
  if (!source) {
    return null;
  }

  const response = await fetch(source, {
    headers: { Accept: "image/*" },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    return null;
  }

  return response;
}

async function fetchBrandfetchFromExisting(sourceUrl: string | null): Promise<Response | null> {
  const source = await getBrandfetchSourceFromExisting(sourceUrl);
  if (!source) {
    return null;
  }

  const response = await fetch(source, {
    headers: { Accept: "image/*" },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    return null;
  }

  return response;
}

async function fetchDirectSource(sourceUrl: string): Promise<Response | null> {
  const response = await fetch(sourceUrl, {
    headers: { Accept: "image/*" },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    return null;
  }

  return response;
}

async function fetchFaviconFallback(domain: string, size: number): Promise<Response | null> {
  const candidates = [
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(domain)}`
  ];

  for (const url of candidates) {
    const response = await fetch(url, {
      headers: { Accept: "image/*" },
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.startsWith("image/")) {
      return response;
    }
  }

  return null;
}

function toImageResponse(sourceResponse: Response): NextResponse {
  const contentType = sourceResponse.headers.get("content-type") || "image/png";
  const body = sourceResponse.body;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400"
    }
  });
}

export async function GET(request: NextRequest) {
  const domainParam = request.nextUrl.searchParams.get("domain");
  const srcParam = request.nextUrl.searchParams.get("src");
  const sizeParam = request.nextUrl.searchParams.get("size");
  const strictParam = request.nextUrl.searchParams.get("strict");

  if (!domainParam && !srcParam) {
    return NextResponse.json({ error: "domain or src query param is required" }, { status: 400 });
  }

  const size = Number(sizeParam ?? "64");
  const clampedSize = Number.isFinite(size) ? Math.min(256, Math.max(32, Math.round(size))) : 64;
  const strictMode = strictParam === "1" || strictParam?.toLowerCase() === "true";

  let domain: string | null = null;
  if (domainParam) {
    try {
      domain = normalizeDomain(domainParam);
    } catch {
      return NextResponse.json({ error: "invalid domain" }, { status: 400 });
    }
  }

  let sourceUrl: string | null = null;
  if (srcParam) {
    try {
      sourceUrl = normalizeSourceUrl(srcParam);
    } catch {
      return NextResponse.json({ error: "invalid src" }, { status: 400 });
    }
  }

  try {
    if (domain) {
      const logoDev = await fetchLogoDev(domain, clampedSize);
      if (logoDev?.body) {
        return toImageResponse(logoDev);
      }

      const brandfetch = await fetchBrandfetch(domain);
      if (brandfetch?.body) {
        return toImageResponse(brandfetch);
      }

      const brandfetchFromExisting = await fetchBrandfetchFromExisting(sourceUrl);
      if (brandfetchFromExisting?.body) {
        return toImageResponse(brandfetchFromExisting);
      }

      if (sourceUrl) {
        const directSource = await fetchDirectSource(sourceUrl);
        if (directSource?.body) {
          return toImageResponse(directSource);
        }
      }

      if (strictMode) {
        return NextResponse.json({ error: "logo not found" }, { status: 404 });
      }

      const fallback = await fetchFaviconFallback(domain, clampedSize);
      if (fallback?.body) {
        return toImageResponse(fallback);
      }
    }

    if (sourceUrl) {
      const directSource = await fetchDirectSource(sourceUrl);
      if (directSource?.body) {
        return toImageResponse(directSource);
      }
    }

    return NextResponse.json({ error: "logo not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "logo fetch failed" }, { status: 502 });
  }
}
