"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Building2, Compass, MapPin, RefreshCw, Route, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FounderFlowResponse, MapFilters } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type DashboardControlsProps = {
  run: FounderFlowResponse;
  isRetrying: boolean;
  retryError: string | null;
  onRetry: () => void;
  showPins: boolean;
  onTogglePins: () => void;
  selectedStartupId?: string | null;
  selectedResourceId?: string | null;
  onStartupSelect?: (startupId: string) => void;
  onResourceSelect?: (resourceId: string) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  activeFilters?: MapFilters | null;
  onClearFilter?: () => void;
};

const STARTUP_AVATAR_COLORS = [
  "#124e66",
  "#0f766e",
  "#1f6f8b",
  "#1b4332",
  "#264653",
  "#2a4365",
  "#155e75",
  "#065f46"
];

function getStartupAvatarColor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }

  return STARTUP_AVATAR_COLORS[Math.abs(hash) % STARTUP_AVATAR_COLORS.length];
}

function getStartupInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

export function DashboardControls({
  run,
  isRetrying,
  retryError,
  onRetry,
  showPins,
  onTogglePins,
  selectedStartupId = null,
  selectedResourceId = null,
  onStartupSelect,
  onResourceSelect,
  activeTab = "overview",
  onTabChange,
  activeFilters = null,
  onClearFilter
}: DashboardControlsProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const { founderProfile, analysis, recommendations, route, roadmap, startups, warnings } = run;

  // Filter startups based on activeFilters
  const filteredStartups = activeFilters && !activeFilters.clearFilters ? startups.filter((startup) => {
    if (activeFilters.sectors && activeFilters.sectors.length > 0) {
      const sectorMatch = activeFilters.sectors.some(
        (sector) => startup.sector?.toLowerCase().includes(sector.toLowerCase())
      );
      if (!sectorMatch) return false;
    }
    if (activeFilters.keywords && activeFilters.keywords.length > 0) {
      const keywordMatch = activeFilters.keywords.some(
        (keyword) =>
          startup.name.toLowerCase().includes(keyword.toLowerCase()) ||
          startup.description?.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!keywordMatch) return false;
    }
    return true;
  }) : startups;

  // Filter resources based on activeFilters
  const filteredResources = activeFilters && !activeFilters.clearFilters ? run.resources.filter((resource) => {
    if (activeFilters.resourceCategories && activeFilters.resourceCategories.length > 0) {
      const categoryMatch = activeFilters.resourceCategories.includes(resource.category);
      if (!categoryMatch) return false;
    }
    if (activeFilters.keywords && activeFilters.keywords.length > 0) {
      const keywordMatch = activeFilters.keywords.some(
        (keyword) =>
          resource.name.toLowerCase().includes(keyword.toLowerCase()) ||
          resource.description.toLowerCase().includes(keyword.toLowerCase()) ||
          resource.tags.some((tag) => tag.toLowerCase().includes(keyword.toLowerCase()))
      );
      if (!keywordMatch) return false;
    }
    return true;
  }) : run.resources;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (activeTab === "startups" && selectedStartupId) {
      const target = container.querySelector<HTMLElement>(`[data-startup-id="${selectedStartupId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }

    if (activeTab === "resources" && selectedResourceId) {
      const target = container.querySelector<HTMLElement>(`[data-resource-id="${selectedResourceId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }
  }, [activeTab, selectedStartupId, selectedResourceId, filteredStartups, filteredResources]);

  return (
    <aside ref={containerRef} className="bg-card/75 backdrop-blur-lg p-5 h-full w-full overflow-y-scroll">
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex w-full flex-col gap-4">
        <TabsList className="grid h-9 w-full grid-cols-4 rounded-lg bg-muted p-1 text-muted-foreground">
          <TabsTrigger
            value="overview"
            className="rounded-md px-3 py-1 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="roadmap"
            className="rounded-md px-3 py-1 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Roadmap
          </TabsTrigger>
          <TabsTrigger
            value="startups"
            className="rounded-md px-3 py-1 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Startups
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="rounded-md px-3 py-1 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
            <Card className="bg-[linear-gradient(135deg,rgba(0,33,66,0.96),rgba(67,167,157,0.62))] text-white">
              <Badge className="mb-4 border-white/20 bg-white/10 text-white">Founder dashboard</Badge>
              <CardTitle className="text-white">{founderProfile.locationCity} founder readiness snapshot</CardTitle>
              <CardDescription className="mt-3 text-white/80">{analysis.suggestedFocus}</CardDescription>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">Stage</p>
                  <p className="mt-2 text-2xl font-semibold capitalize">{analysis.stage}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">Confidence</p>
                  <p className="mt-2 text-2xl font-semibold">{Math.round(analysis.confidenceScore * 100)}%</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">Top route</p>
                  <p className="mt-2 text-2xl font-semibold">{route ? `${route.totalDriveTimeMinutes}m` : "Pending"}</p>
                </div>
              </div>
            </Card>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <h4 className="font-semibold">Recommendations</h4>
              </div>
              <div className="space-y-3">
                {recommendations.map((recommendation, index) => (
                  <div key={recommendation.id} className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Rank {index + 1}</p>
                        <p className="mt-1 font-semibold">{recommendation.resourceName}</p>
                      </div>
                      <Badge className="bg-secondary/15 text-secondary">{recommendation.priority}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{recommendation.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Needs and risks</h4>
              </div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Primary needs</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {analysis.primaryNeeds.map((need) => (
                  <Badge key={need}>{need.replaceAll("_", " ")}</Badge>
                ))}
              </div>
              <ul className="space-y-2">
                {analysis.risks.map((risk) => (
                  <li key={risk} className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-3">
            <div className="mb-2 flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">30-day roadmap</h4>
            </div>
            {roadmap ? (
              <div className="space-y-3">
                {roadmap.weeks.map((week) => (
                  <div key={week.weekNumber} className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Week {week.weekNumber}</p>
                    <p className="mt-1 font-semibold">{week.goal}</p>
                    <ul className="mt-2 space-y-2">
                      {week.tasks.map((task) => (
                        <li key={task.title} className="rounded-xl bg-background/80 px-2.5 py-2 text-sm">
                          <span className="font-semibold">{task.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{task.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <CardDescription>No roadmap available yet.</CardDescription>
            )}
        </TabsContent>

        <TabsContent value="startups" className="space-y-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Startup profiles</h4>
              </div>

              {activeFilters && !activeFilters.clearFilters ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                  <Badge className="bg-primary/20 text-primary text-xs">
                    {filteredStartups.length} of {startups.length} matching
                  </Badge>
                  <button
                    type="button"
                    onClick={onClearFilter}
                    className="ml-auto text-xs font-medium text-primary hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              ) : null}

              {filteredStartups.length > 0 ? (
                <div className="space-y-2">
                  {filteredStartups.map((startup) => (
                    <button
                      key={startup.id}
                      data-startup-id={startup.id}
                      type="button"
                      onClick={() => onStartupSelect?.(startup.id)}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-2.5 text-left transition-colors",
                        selectedStartupId === startup.id
                          ? "border-primary/60 bg-primary/12 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.18)]"
                          : "border-border/70 bg-muted/35 hover:border-primary/30 hover:bg-muted/55"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-8 w-8 shrink-0">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold text-white"
                              style={{ backgroundColor: getStartupAvatarColor(startup.name) }}
                              aria-hidden="true"
                            >
                              {getStartupInitial(startup.name)}
                            </div>
                            {startup.logoUrl ? (
                              <img
                                src={startup.logoUrl}
                                alt={`${startup.name} logo`}
                                className="absolute inset-0 h-8 w-8 rounded-md bg-background/70 object-contain p-1"
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{startup.name}</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              {startup.sector ?? "Uncategorized"}
                            </p>
                          </div>
                        </div>
                        {startup.employees ? (
                          <Badge className="bg-secondary/15 text-secondary">
                            <Users className="mr-1 h-3 w-3" />
                            {startup.employees}</Badge>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
                  {activeFilters && !activeFilters.clearFilters ? "No startup profiles match the current filters." : "No startup profiles are available for this run."}
                </div>
              )}
            </div>

            {warnings.length > 0 || retryError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="font-semibold text-destructive">Partial fallback state</p>
                </div>
                <ul className="mb-3 space-y-1 text-sm text-foreground">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                  {retryError ? <li key="retry-error">{retryError}</li> : null}
                </ul>
                <Button variant="secondary" size="sm" onClick={onRetry} disabled={isRetrying}>
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                  {isRetrying ? "Retrying" : "Retry services"}
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
                All services healthy. No active warnings.
              </div>
            )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">Map resources</h4>
          </div>

          {activeFilters && !activeFilters.clearFilters ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
              <Badge className="bg-primary/20 text-primary text-xs">
                {filteredResources.length} of {run.resources.length} matching
              </Badge>
              <button
                type="button"
                onClick={onClearFilter}
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Clear filter
              </button>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Show resource pins</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Toggle pins on the map</p>
              </div>
              <button
                type="button"
                onClick={onTogglePins}
                aria-pressed={showPins}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${showPins ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${showPins ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredResources.map((resource) => (
              <button
                key={resource.id}
                data-resource-id={resource.id}
                type="button"
                onClick={() => onResourceSelect?.(resource.id)}
                className={cn(
                  "w-full rounded-2xl border px-3 py-2.5 text-left transition-colors",
                  selectedResourceId === resource.id
                    ? "border-primary/60 bg-primary/12 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.18)]"
                    : "border-border/70 bg-muted/35 hover:border-primary/30 hover:bg-muted/55"
                )}
              >
                <p className="text-sm font-semibold">{resource.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize">{resource.category.replaceAll("_", " ")}</p>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

    </aside>
  );
}
