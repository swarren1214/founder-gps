import { NextRequest, NextResponse } from "next/server";

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

async function fetchImage(url: string): Promise<Response | null> {
  const response = await fetch(url, {
    headers: { Accept: "image/*" },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    return null;
  }

  return response;
}

function toImageResponse(sourceResponse: Response): NextResponse {
  const contentType = sourceResponse.headers.get("content-type") || "image/png";
  const body = sourceResponse.body;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0"
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
      const directSource = await fetchImage(sourceUrl);
      if (directSource?.body) {
        return toImageResponse(directSource);
      }
    }

    if (domain) {
      const logoDev = await fetchImage(logoDevUrl(domain, clampedSize));
      if (logoDev?.body) {
        return toImageResponse(logoDev);
      }

      if (strictMode) {
        return NextResponse.json({ error: "logo not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "logo not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "logo lookup failed" }, { status: 502 });
  }
}
