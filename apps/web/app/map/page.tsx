"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FounderMap } from "@/components/map/founder-map";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function MapPage() {
  const router = useRouter();
  const { isLoading, isOnboarded, run } = useOnboardingGate();

  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace("/onboarding");
    }
  }, [isLoading, isOnboarded, router]);

  if (isLoading) {
    return (
      <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardTitle>Loading map...</CardTitle>
            <CardDescription className="mt-3">Preparing your founder route data.</CardDescription>
          </Card>
        </div>
      </main>
    );
  }

  if (!isOnboarded || !run) {
    return (
      <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardTitle>Redirecting to onboarding...</CardTitle>
            <CardDescription className="mt-3">
              Complete onboarding first to unlock the full-screen founder map.
            </CardDescription>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell min-h-screen overflow-hidden px-0 py-0">
      <FounderMap
        className="h-[calc(100vh-4rem)] min-h-[calc(100vh-4rem)] w-full rounded-none"
        resources={run.resources}
        recommendations={run.recommendations}
        route={run.route}
        founderLocation={{
          city: run.founderProfile.locationCity,
          lat: run.founderProfile.locationLat,
          lng: run.founderProfile.locationLng
        }}
      />
    </main>
  );
}
