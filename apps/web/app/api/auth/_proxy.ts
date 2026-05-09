import { NextResponse } from "next/server";
import { getAuthServiceUrl } from "@/lib/auth-service";
import { isSameOriginRequest } from "@/lib/request-security";

const AUTH_PROXY_TIMEOUT_MS = 5000;

export async function proxyAuthRequest(request: Request, pathname: string): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Invalid request origin." } }, { status: 403 });
  }

  const requestBody = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : Buffer.from(await request.arrayBuffer());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_PROXY_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(`${getAuthServiceUrl()}${pathname}`, {
      method: request.method,
      headers: {
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type") as string }
          : {}),
        cookie: request.headers.get("cookie") ?? "",
        ...(request.headers.get("x-forwarded-for") ? { "x-forwarded-for": request.headers.get("x-forwarded-for") as string } : {}),
        ...(request.headers.get("x-real-ip") ? { "x-real-ip": request.headers.get("x-real-ip") as string } : {}),
        ...(request.headers.get("user-agent") ? { "user-agent": request.headers.get("user-agent") as string } : {})
      },
      body: requestBody,
      cache: "no-store",
      signal: controller.signal
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "AUTH_SERVICE_UNAVAILABLE",
          message: "Authentication service is unavailable. Please try again."
        }
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await upstream.json()
    : { error: await upstream.text() };

  const response = NextResponse.json(payload, { status: upstream.status });
  response.headers.set("cache-control", "no-store, max-age=0");
  response.headers.set("pragma", "no-cache");
  response.headers.set("x-content-type-options", "nosniff");
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
