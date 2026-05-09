"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FounderIntakeForm } from "@/components/onboarding/founder-intake-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuthUser } from "@/hooks/use-auth-user";

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoading, authUser } = useAuthUser();
  const isOnboarded = authUser?.profile.onboardingStatus === "completed";

  useEffect(() => {
    if (!isLoading && isOnboarded) {
      router.replace("/authed/dashboard");
    }
  }, [isLoading, isOnboarded, router]);

  if (!isLoading && isOnboarded) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_84%_16%,hsl(var(--card)),transparent_30%)]" />
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardTitle>Onboarding already complete</CardTitle>
            <CardDescription className="mt-3">
              Taking you to your dashboard. You can update details later from Profile.
            </CardDescription>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_84%_16%,hsl(var(--card)),transparent_30%)]" />
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <FounderIntakeForm />
      </div>
    </main>
  );
}
