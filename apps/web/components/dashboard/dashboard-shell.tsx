"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { founderFlowResponseSchema, type FounderFlowResponse, type MapFilters } from "@/lib/schemas";
import { saveDashboardRun } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FounderMap } from "@/components/map/founder-map";
import { DashboardControls } from "@/components/dashboard/dashboard-controls";
import { MapChat } from "@/components/dashboard/map-chat";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardInlineSkeleton } from "@/components/ui/loading-screens";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { toast } from "sonner";

export function DashboardShell() {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();
  const { isLoading, isOnboarded, run } = useOnboardingGate();
  const [currentRun, setCurrentRun] = useState<FounderFlowResponse | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [showStartupPins, setShowStartupPins] = useState(true);
  const [showResourcePins, setShowResourcePins] = useState(true);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<MapFilters | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
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
      } catch (hydrateError) {
        const message = hydrateError instanceof Error ? hydrateError.message : "Failed to load startup profiles.";
        toast.error(message);
      }
    };

    void hydrateStartups();
  }, [currentRun]);

  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace("/authed/onboarding");
    }
  }, [isLoading, isOnboarded, router]);

  useEffect(() => {
    setSelectedStartupId((existingId) => {
      if (!existingId || !currentRun) {
        return existingId;
      }

      return currentRun.startups.some((startup) => startup.id === existingId) ? existingId : null;
    });
  }, [currentRun]);

  if (isLoading) {
    return <DashboardInlineSkeleton />;
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
      toast.promise(
        (async () => {
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

          const rawBody = await response.text();
          let payload: unknown = null;
          if (rawBody.length > 0) {
            try {
              payload = JSON.parse(rawBody);
            } catch {
              const message = rawBody.slice(0, 180).replace(/\s+/g, " ").trim();
              throw new Error(
                message ? `Founder flow endpoint returned non-JSON response: ${message}` : "Founder flow endpoint returned non-JSON response."
              );
            }
          }

          if (!response.ok) {
            const errorMessage =
              payload &&
              typeof payload === "object" &&
              "error" in payload &&
              typeof (payload as { error?: unknown }).error === "string"
                ? (payload as { error: string }).error
                : "Retry failed.";
            throw new Error(errorMessage);
          }

          const parsed = founderFlowResponseSchema.parse(payload);
          saveDashboardRun(parsed);
          setCurrentRun(parsed);
          trackEvent("founder_flow_retry_completed", {
            warnings: parsed.warnings.length,
            hasRoute: Boolean(parsed.route),
            hasRoadmap: Boolean(parsed.roadmap)
          });
        })(),
        {
          loading: "Regenerating your founder plan...",
          success: "Founder plan updated.",
          error: (error) => (error instanceof Error ? error.message : "Retry failed.")
        }
      );
    });
  }

  const { founderProfile, recommendations, route, resources, startups } = currentRun;

  function handleStartupSelect(startupId: string) {
    setSelectedStartupId(startupId);
    setSelectedResourceId(null);
    setActiveTab("startups");
    setShowStartupPins(true);
  }

  function handleResourceSelect(resourceId: string) {
    setSelectedResourceId(resourceId);
    setSelectedStartupId(null);
    setActiveTab("resources");
    setShowResourcePins(true);
  }

  function handlePinSelect(pin: { id: string; kind: "startup" | "resource" }) {
    if (pin.kind === "startup") {
      handleStartupSelect(pin.id);
      return;
    }
    handleResourceSelect(pin.id);
  }

  function handleChatFilter(filters: MapFilters) {
    setActiveFilters(filters);
    if (filters.tab) {
      setActiveTab(filters.tab);
    }
    if (filters.clearFilters) {
      setActiveFilters(null);
    }
  }

  function handleClearFilter() {
    setActiveFilters(null);
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Map fills the entire background */}
      <FounderMap
        showStartupPins={showStartupPins}
        showResourcePins={showResourcePins}
        activeTab={activeTab}
        className="absolute inset-0 h-full w-full rounded-none"
        resources={resources}
        startups={startups}
        recommendations={recommendations}
        route={route}
        selectedStartupId={selectedStartupId}
        selectedResourceId={selectedResourceId}
        onPinSelect={handlePinSelect}
        activeFilters={activeFilters}
        founderLocation={{
          city: founderProfile.locationCity,
          lat: founderProfile.locationLat,
          lng: founderProfile.locationLng
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <motion.div
          className="absolute bottom-4 left-4 top-4 z-20 flex w-[420px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl backdrop-blur-lg"
          initial={{ opacity: 0, x: -16, y: -8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="sticky top-0 z-20 border-b border-border/60 bg-card/92 p-2.5 backdrop-blur-lg">
            <TabsList className="grid h-12 w-full grid-cols-4 rounded-xl bg-muted/80 p-1 text-muted-foreground">
              <TabsTrigger
                value="overview"
                className="rounded-lg px-2.5 py-1.5 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="roadmap"
                className="rounded-lg px-2.5 py-1.5 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Roadmap
              </TabsTrigger>
              <TabsTrigger
                value="startups"
                className="rounded-lg px-2.5 py-1.5 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Startups
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="rounded-lg px-2.5 py-1.5 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Resources
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <DashboardControls
              run={currentRun}
              isRetrying={isRetrying}
              retryError={retryError}
              onRetry={retryRun}
              showStartupPins={showStartupPins}
              showResourcePins={showResourcePins}
              onToggleStartupPins={() => setShowStartupPins((value) => !value)}
              onToggleResourcePins={() => setShowResourcePins((value) => !value)}
              selectedStartupId={selectedStartupId}
              selectedResourceId={selectedResourceId}
              onStartupSelect={handleStartupSelect}
              onResourceSelect={handleResourceSelect}
              activeTab={activeTab}
              activeFilters={activeFilters}
              onClearFilter={handleClearFilter}
              onStartupClear={() => setSelectedStartupId(null)}
              onResourceClear={() => setSelectedResourceId(null)}
            />
          </div>
        </motion.div>
      </Tabs>

      <MapChat
        founderProfile={founderProfile}
        analysis={currentRun.analysis}
        resources={resources}
        startups={startups}
        onFilter={handleChatFilter}
        onClearFilter={handleClearFilter}
      />
    </div>
  );
}
