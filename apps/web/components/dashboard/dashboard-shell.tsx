"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  const [showPins, setShowPins] = useState(true);
  const hasAttemptedStartupHydration = useRef(false);

  useEffect(() => {
    if (run) {
      hasAttemptedStartupHydration.current = false;
      setCurrentRun(run);
    }
  }, [run]);

  useEffect(() => {
    if (!currentRun || currentRun.startups.length > 0 || hasAttemptedStartupHydration.current) {
      return;
    }

    hasAttemptedStartupHydration.current = true;

    const hydrateStartups = async () => {
      try {
        const response = await fetch("/api/startups?limit=1000", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load startup profiles.");
        }

        if (!Array.isArray(payload.startups) || payload.startups.length === 0) {
          return;
        }

        setCurrentRun((existing) => {
          if (!existing) {
            return existing;
          }

          const mergedRun = { ...existing, startups: payload.startups };
          saveDashboardRun(mergedRun);
          return mergedRun;
        });
      } catch {
        // Startup hydration is a best-effort fallback for older session payloads.
      }
    };

    void hydrateStartups();
  }, [currentRun]);

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

  const { founderProfile, recommendations, route, resources, startups } = currentRun;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Map fills the entire background */}
      <FounderMap
        showPins={showPins}
        className="absolute inset-0 h-full w-full rounded-none"
        resources={resources}
        startups={startups}
        recommendations={recommendations}
        route={route}
        founderLocation={{
          city: founderProfile.locationCity,
          lat: founderProfile.locationLat,
          lng: founderProfile.locationLng
        }}
      />

      {/* Controls panel floats over the map */}
      <motion.div
        className="absolute left-4 top-4 bottom-4 z-10 w-[420px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <DashboardControls run={currentRun} isRetrying={isRetrying} retryError={retryError} onRetry={retryRun} showPins={showPins} onTogglePins={() => setShowPins((v) => !v)} />
      </motion.div>
    </div>
  );
}
