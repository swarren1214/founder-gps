import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";

const resourceServiceUrl = process.env.NEXT_PUBLIC_RESOURCE_SERVICE_URL ?? "http://localhost:4001";

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function parseJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    const maybeError = payload?.error;
    if (typeof maybeError === "string") {
      throw new Error(maybeError);
    }

    if (maybeError && typeof maybeError === "object") {
      const code = "code" in maybeError ? String(maybeError.code) : "UNKNOWN_ERROR";
      const message = "message" in maybeError ? String(maybeError.message) : `Request failed with ${response.status}`;
      throw new Error(`${code}: ${message}`);
    }

    throw new Error(`Request failed with ${response.status}`);
  }

  return payload;
}

export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit") ?? "1000";
    const city = url.searchParams.get("city");
    const q = url.searchParams.get("q");

    const query = new URLSearchParams({ limit });
    if (city) {
      query.set("city", city);
    }
    if (q) {
      query.set("q", q);
    }

    const response = await fetch(`${resourceServiceUrl}/startups?${query.toString()}`, {
      headers: { "X-Request-ID": requestId },
      cache: "no-store"
    });

    const payload = await parseJson(response);
    return NextResponse.json({ startups: payload.startups ?? [], count: payload.count ?? 0, requestId });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to load startup profiles.";
    return NextResponse.json({ error: errorMsg, requestId }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const requestId = generateRequestId();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Invalid request origin." } }, { status: 403 });
  }

  try {
    const body = await request.json();

    const response = await fetch(`${resourceServiceUrl}/startups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const payload = await parseJson(response);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to create startup profile.";
    return NextResponse.json({ error: errorMsg, requestId }, { status: 503 });
  }
}
