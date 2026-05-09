"use client";

import { useCallback, useEffect, useState } from "react";

export const AUTH_USER_REFRESH_EVENT = "auth-user:refresh";

export function broadcastAuthUserRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_USER_REFRESH_EVENT));
  }
}

export type OnboardingContextPayload = Record<string, unknown>;

export type AuthUserPayload = {
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
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    roleTitle: string | null;
    bio: string | null;
    locationCity: string | null;
    onboardingContext: OnboardingContextPayload;
    avatarUrl: string | null;
    avatarStorageKey: string | null;
    onboardingStatus: "not_started" | "in_progress" | "completed";
    onboardingCompletedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export function useAuthUser() {
  const [isLoading, setIsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUserPayload | null>(null);

  const loadUser = useCallback(async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) {
      setAuthUser(null);
      return;
    }

    const payload = (await response.json()) as AuthUserPayload;
    setAuthUser(payload);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadUserSafe() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          if (!isCancelled) {
            setAuthUser(null);
          }
          return;
        }

        const payload = (await response.json()) as AuthUserPayload;
        if (!isCancelled) {
          setAuthUser(payload);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    function handleRefresh() {
      void loadUser();
    }

    void loadUserSafe();
    window.addEventListener(AUTH_USER_REFRESH_EVENT, handleRefresh);

    return () => {
      isCancelled = true;
      window.removeEventListener(AUTH_USER_REFRESH_EVENT, handleRefresh);
    };
  }, [loadUser]);

  return {
    isLoading,
    authUser,
    isAuthenticated: Boolean(authUser),
    refreshAuthUser: loadUser
  };
}
