import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { getProtectedRouteRedirectTarget } from "@/lib/auth-routing";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const authenticatedUser = await getAuthenticatedUserFromCookies();
  const redirectTarget = getProtectedRouteRedirectTarget(Boolean(authenticatedUser));
  if (redirectTarget) {
    redirect(redirectTarget);
  }

  return <>{children}</>;
}
