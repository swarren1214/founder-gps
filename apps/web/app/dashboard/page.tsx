import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { AUTH_REDIRECTS } from "@/lib/auth-routing";

export default async function DashboardPage() {
  const authenticatedUser = await getAuthenticatedUserFromCookies();
  redirect(authenticatedUser ? AUTH_REDIRECTS.authedHome : AUTH_REDIRECTS.login);
}
