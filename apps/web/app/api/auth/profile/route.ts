import { proxyAuthRequest } from "../_proxy";

export async function PATCH(request: Request) {
  return proxyAuthRequest(request, "/profile");
}
