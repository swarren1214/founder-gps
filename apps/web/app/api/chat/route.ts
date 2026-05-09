import { NextRequest, NextResponse } from "next/server";
import { chatRequestSchema, chatResponseSchema, type ChatRequest } from "../../../lib/schemas";

const intelligenceServiceUrl = process.env.NEXT_PUBLIC_INTELLIGENCE_SERVICE_URL ?? "http://localhost:4003";
const CHAT_TIMEOUT_MS = 10000;

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

async function fetchWithTimeout(url: string, options: RequestInit, requestId: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Request-ID", requestId);

  try {
    return await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const body = (await request.json()) as ChatRequest;
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten(), requestId }, { status: 400 });
    }

    const response = await fetchWithTimeout(
      `${intelligenceServiceUrl}/intelligence/chat`,
      {
        method: "POST",
        body: JSON.stringify(parsed.data)
      },
      requestId
    );

    const payload = await parseJson(response);
    const validated = chatResponseSchema.parse(payload);

    return NextResponse.json({ ...validated, requestId });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Chat request failed";
    return NextResponse.json({ error: errorMsg, requestId }, { status: 503 });
  }
}
