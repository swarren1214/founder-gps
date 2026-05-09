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
      <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
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
    <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <FounderIntakeForm />
      </div>
    </main>
  );
}
