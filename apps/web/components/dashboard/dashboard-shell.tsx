"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ExternalLink, MapPin, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { founderFlowResponseSchema, type FounderFlowResponse, type MapFilters } from "@/lib/schemas";
import { saveDashboardRun } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FounderMap } from "@/components/map/founder-map";
import { DashboardControls } from "@/components/dashboard/dashboard-controls";
import { MapChat } from "@/components/dashboard/map-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";

export function DashboardShell() {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();
  const { isLoading, isOnboarded, run } = useOnboardingGate();
  const [currentRun, setCurrentRun] = useState<FounderFlowResponse | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [showPins, setShowPins] = useState(true);
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

  useEffect(() => {
    setSelectedStartupId((existingId) => {
      if (!existingId || !currentRun) {
        return existingId;
      }

      return currentRun.startups.some((startup) => startup.id === existingId) ? existingId : null;
    });
  }, [currentRun]);

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
  const selectedStartup = selectedStartupId ? startups.find((startup) => startup.id === selectedStartupId) ?? null : null;

  function handleStartupSelect(startupId: string) {
    setSelectedStartupId(startupId);
    setSelectedResourceId(null);
    setActiveTab("startups");
    setShowPins(true);
  }

  function handleResourceSelect(resourceId: string) {
    setSelectedResourceId(resourceId);
    setSelectedStartupId(null);
    setActiveTab("resources");
    setShowPins(true);
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
        showPins={showPins}
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

      {/* Controls panel floats over the map */}
      <motion.div
        className="absolute left-4 top-4 bottom-4 z-10 w-[420px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <DashboardControls
          run={currentRun}
          isRetrying={isRetrying}
          retryError={retryError}
          onRetry={retryRun}
          showPins={showPins}
          onTogglePins={() => setShowPins((v) => !v)}
          selectedStartupId={selectedStartupId}
          selectedResourceId={selectedResourceId}
          onStartupSelect={handleStartupSelect}
          onResourceSelect={handleResourceSelect}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeFilters={activeFilters}
          onClearFilter={handleClearFilter}
        />
      </motion.div>

      <AnimatePresence>
        {selectedStartup ? (
          <motion.aside
            key={selectedStartup.id}
            className="absolute bottom-4 right-4 top-4 z-10 flex w-[360px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-lg"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.24 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Startup profile</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{selectedStartup.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedStartup.sector ?? "Uncategorized"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedStartupId(null)} aria-label="Close startup profile">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {selectedStartup.employees ? (
                  <Badge className="bg-secondary/15 text-secondary">
                    <Users className="mr-1 h-3 w-3" />
                    {selectedStartup.employees}
                  </Badge>
                ) : null}
                {selectedStartup.yearFounded ? (
                  <Badge className="border border-border/70 bg-background text-foreground">Founded {selectedStartup.yearFounded}</Badge>
                ) : null}
                {selectedStartup.hiringStatus ? (
                  <Badge className="border border-border/70 bg-background text-foreground">{selectedStartup.hiringStatus}</Badge>
                ) : null}
              </div>

              {selectedStartup.description ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Overview</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/90">{selectedStartup.description}</p>
                </div>
              ) : null}

              <div className="space-y-3">
                {selectedStartup.address ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Address</p>
                        <p className="mt-1 text-sm text-foreground">{selectedStartup.address}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedStartup.website ? (
                  <a
                    href={selectedStartup.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted/55"
                  >
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Website</p>
                        <p className="mt-1 break-all">{selectedStartup.website}</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ) : null}

                {selectedStartup.linkedin ? (
                  <a
                    href={selectedStartup.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted/55"
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">LinkedIn</p>
                      <p className="mt-1 break-all">{selectedStartup.linkedin}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Job postings</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{selectedStartup.jobPostings.length}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Photo gallery</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{selectedStartup.photoGallery.length}</p>
                </div>
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

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
