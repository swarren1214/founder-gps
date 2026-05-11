import { NextResponse } from "next/server";
import { getResourceServiceUrl } from "@/lib/service-urls";

const resourceServiceUrl = getResourceServiceUrl();

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
    const incomingUrl = new URL(request.url);
    const query = new URLSearchParams(incomingUrl.searchParams);

    if (!query.has("limit")) {
      query.set("limit", "500");
    }

    const response = await fetch(`${resourceServiceUrl}/resources?${query.toString()}`, {
      headers: { "X-Request-ID": requestId },
      cache: "no-store"
    });

    const payload = await parseJson(response);
    return NextResponse.json({ resources: payload.resources ?? [], count: payload.count ?? 0, requestId });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to load resources.";
    return NextResponse.json({ error: errorMsg, requestId }, { status: 503 });
  }
}
