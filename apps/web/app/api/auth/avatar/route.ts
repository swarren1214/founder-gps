import { proxyAuthRequest } from "../_proxy";

export async function POST(request: Request) {
  return proxyAuthRequest(request, "/profile/avatar");
}

export async function DELETE(request: Request) {
  return proxyAuthRequest(request, "/profile/avatar");
}
