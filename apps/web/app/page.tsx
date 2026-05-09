import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";

export default async function HomePage() {
  const authenticatedUser = await getAuthenticatedUserFromCookies();
  if (authenticatedUser) {
    redirect("/authed/dashboard");
  }

  redirect("/login");
}
