import { cookies } from "next/headers";
import { getAuthServiceUrl } from "@/lib/auth-service";

export type AuthenticatedUser = {
  user: {
    id: string;
    email: string;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  profile: {
    id: string;
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    onboardingStatus: "not_started" | "in_progress" | "completed";
    onboardingCompletedAt: string | null;
  };
};

export async function getAuthenticatedUserFromCookies(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  if (!cookieHeader) {
    return null;
  }

  const response = await fetch(`${getAuthServiceUrl()}/auth/me`, {
    method: "GET",
    headers: {
      cookie: cookieHeader
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthenticatedUser;
}
