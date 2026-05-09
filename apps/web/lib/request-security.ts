export function isSameOriginRequest(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return true;
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === requestOrigin;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    return new URL(referer).origin === requestOrigin;
  }

  return false;
}
