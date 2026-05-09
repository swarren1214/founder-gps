import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { AUTH_REDIRECTS } from "@/lib/auth-routing";

export default async function HomePage() {
  const authenticatedUser = await getAuthenticatedUserFromCookies();
  if (authenticatedUser) {
    redirect(AUTH_REDIRECTS.authedHome);
  }

  redirect(AUTH_REDIRECTS.login);
}
