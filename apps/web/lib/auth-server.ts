import { cookies } from "next/headers";
import { getAuthServiceUrl } from "@/lib/auth-service";

const DEFAULT_AUTH_COOKIE_NAME = "fg_session";
const AUTH_ME_TIMEOUT_MS = 2500;

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
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    roleTitle: string | null;
    bio: string | null;
    locationCity: string | null;
    onboardingContext: Record<string, unknown>;
    avatarUrl: string | null;
    avatarStorageKey: string | null;
    onboardingStatus: "not_started" | "in_progress" | "completed";
    onboardingCompletedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export async function getAuthenticatedUserFromCookies(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const authCookieName = process.env.AUTH_COOKIE_NAME ?? DEFAULT_AUTH_COOKIE_NAME;
  const sessionCookie = cookieStore.get(authCookieName);
  if (!sessionCookie?.value) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);

  try {
    const response = await fetch(`${getAuthServiceUrl()}/auth/me`, {
      method: "GET",
      headers: {
        cookie: `${authCookieName}=${sessionCookie.value}`
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthenticatedUser;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
