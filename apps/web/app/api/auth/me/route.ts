import { proxyAuthRequest } from "../_proxy";

export async function GET(request: Request) {
  return proxyAuthRequest(request, "/auth/me");
}
