"use client";

import { useEffect, useState } from "react";

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
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    roleTitle: string | null;
    bio: string | null;
    locationCity: string | null;
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

  useEffect(() => {
    let isCancelled = false;

    async function loadUser() {
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

    loadUser();

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    isLoading,
    authUser,
    isAuthenticated: Boolean(authUser)
  };
}
