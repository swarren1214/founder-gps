import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";

export default async function DashboardPage() {
  const authenticatedUser = await getAuthenticatedUserFromCookies();
  redirect(authenticatedUser ? "/authed/dashboard" : "/login");
}
