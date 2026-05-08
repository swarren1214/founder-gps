"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { founderFlowResponseSchema, type FounderFlowResponse } from "@/lib/schemas";
import { saveDashboardRun } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FounderMap } from "@/components/map/founder-map";
import { DashboardControls } from "@/components/dashboard/dashboard-controls";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";

export function DashboardShell() {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();
  const { isLoading, isOnboarded, run } = useOnboardingGate();
  const [currentRun, setCurrentRun] = useState<FounderFlowResponse | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (run) {
      setCurrentRun(run);
    }
  }, [run]);

  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace("/onboarding");
    }
  }, [isLoading, isOnboarded, router]);

  if (isLoading) {
    return (
      <Card>
        <CardTitle>Loading dashboard...</CardTitle>
        <CardDescription className="mt-3">Checking your current founder session.</CardDescription>
      </Card>
    );
  }

  if (!isOnboarded || !currentRun) {
    return (
      <Card>
        <CardTitle>Redirecting to onboarding...</CardTitle>
        <CardDescription className="mt-3">
          No founder run was found for this session.
        </CardDescription>
      </Card>
    );
  }

  async function retryRun() {
    if (!currentRun) {
      return;
    }

    const existingRun = currentRun;

    startTransition(async () => {
      try {
        setRetryError(null);
        trackEvent("founder_flow_retry_requested", {
          city: existingRun.founderProfile.locationCity,
          topN: existingRun.founderProfile.topN
        });

        const response = await fetch("/api/founder-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existingRun.founderProfile)
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Retry failed.");
        }

        const parsed = founderFlowResponseSchema.parse(payload);
        saveDashboardRun(parsed);
        setCurrentRun(parsed);
        trackEvent("founder_flow_retry_completed", {
          warnings: parsed.warnings.length,
          hasRoute: Boolean(parsed.route),
          hasRoadmap: Boolean(parsed.roadmap)
        });
      } catch (error) {
        setRetryError(error instanceof Error ? error.message : "Retry failed.");
      }
    });
  }

  const { founderProfile, recommendations, route, resources } = currentRun;

  return (
    <div className="grid min-h-[calc(100vh)] grid-cols-1 items-start xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] 2xl:gap-5">
      <motion.div className="min-w-0" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <DashboardControls run={currentRun} isRetrying={isRetrying} retryError={retryError} onRetry={retryRun} />
      </motion.div>

      <motion.div className="min-w-0" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <FounderMap
          className="h-[calc(100vh-5rem)] min-h-[640px] max-h-none rounded-none"
          resources={resources}
          recommendations={recommendations}
          route={route}
          founderLocation={{
            city: founderProfile.locationCity,
            lat: founderProfile.locationLat,
            lng: founderProfile.locationLng
          }}
        />
      </motion.div>
    </div>
  );
}
