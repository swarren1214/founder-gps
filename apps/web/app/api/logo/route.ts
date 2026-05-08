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
    if (sourceUrl) {
      const directSource = await fetchDirectSource(sourceUrl);
      if (directSource?.body) {
        return toImageResponse(directSource);
      }
    }

    if (domain) {
      const brandfetch = await fetchBrandfetch(domain);
      if (brandfetch?.body) {
        return toImageResponse(brandfetch);
      }

      if (strictMode) {
        return NextResponse.json({ error: "logo not found" }, { status: 404 });
      }

      const logoDev = await fetchLogoDev(domain, clampedSize);
      if (logoDev?.body) {
        return toImageResponse(logoDev);
      }

      const fallback = await fetchFaviconFallback(domain, clampedSize);
      if (fallback?.body) {
        return toImageResponse(fallback);
      }
    }

    return NextResponse.json({ error: "logo not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "logo fetch failed" }, { status: 502 });
  }
}
