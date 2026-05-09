import { proxyAuthRequest } from "../_proxy";

export async function POST(request: Request) {
  return proxyAuthRequest(request, "/auth/login");
}
