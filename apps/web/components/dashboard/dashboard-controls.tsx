"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Compass,
  ExternalLink,
  MapPin,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { filterResources, filterStartups } from "@/lib/map-filters";
import { RoadmapTaskManager } from "@/components/dashboard/roadmap-task-manager";
import { TabsContent } from "@/components/ui/tabs";
import type { FounderFlowResponse, MapFilters } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type DashboardControlsProps = {
  run: FounderFlowResponse;
  isRetrying: boolean;
  retryError: string | null;
  onRetry: () => void;
  showStartupPins: boolean;
  showResourcePins: boolean;
  onToggleStartupPins: () => void;
  onToggleResourcePins: () => void;
  selectedStartupId?: string | null;
  selectedResourceId?: string | null;
  onStartupSelect?: (startupId: string) => void;
  onStartupClear?: () => void;
  onResourceSelect?: (resourceId: string) => void;
  onResourceClear?: () => void;
  activeTab?: string;
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

function getDomainFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function appendVersionParam(url: string, versionToken: string | null): string {
  if (!versionToken) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(versionToken)}`;
}

function resolveLogoSource(
  logoUrl: string | null,
  website: string | null,
  updatedAt: string | null,
  strict = true
): string | null {
  const versionToken = updatedAt ? String(Date.parse(updatedAt) || updatedAt) : null;

  const domain = getDomainFromUrl(website);
  if (logoUrl) {
    if (!/^https?:\/\//i.test(logoUrl)) {
      return null;
    }

    return appendVersionParam(
      `/api/logo?src=${encodeURIComponent(logoUrl)}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}&size=64${strict ? "&strict=1" : ""}`,
      versionToken
    );
  }

  return null;
}

export function DashboardControls({
  run,
  isRetrying,
  retryError,
  onRetry,
  showStartupPins,
  showResourcePins,
  onToggleStartupPins,
  onToggleResourcePins,
  selectedStartupId = null,
  selectedResourceId = null,
  onStartupSelect,
  onStartupClear,
  onResourceSelect,
  onResourceClear,
  activeTab = "overview",
  activeFilters = null,
  onClearFilter
}: DashboardControlsProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [logoLoadFailures, setLogoLoadFailures] = useState<Record<string, boolean>>({});
  const [startupSearchQuery, setStartupSearchQuery] = useState("");
  const [startupSectorFilter, setStartupSectorFilter] = useState("all");
  const [startupEmployeeFilter, setStartupEmployeeFilter] = useState("all");
  const [startupFiltersExpanded, setStartupFiltersExpanded] = useState(false);
  const [resourceSearchQuery, setResourceSearchQuery] = useState("");
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState("all");
  const [resourceStateFilter, setResourceStateFilter] = useState("all");
  const [resourceFiltersExpanded, setResourceFiltersExpanded] = useState(false);
  const { founderProfile, analysis, recommendations, route, startups, warnings } = run;

  const filteredStartups = filterStartups(startups, activeFilters);
  const filteredResources = filterResources(run.resources, activeFilters);
  const startupSectorOptions = Array.from(
    new Set(filteredStartups.map((startup) => startup.sector?.trim()).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right));
  const startupEmployeeOptions = Array.from(
    new Set(filteredStartups.map((startup) => startup.employees?.trim()).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right));
  const resourceCategoryOptions = Array.from(
    new Set(filteredResources.map((resource) => resource.category))
  ).sort((left, right) => left.localeCompare(right));
  const resourceStateOptions = Array.from(
    new Set(filteredResources.map((resource) => resource.state?.trim()).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right));

  const displayedStartups = filteredStartups.filter((startup) => {
    const normalizedSearch = startupSearchQuery.trim().toLowerCase();
    const startupSector = startup.sector?.trim() ?? "";
    const matchesSearch =
      normalizedSearch.length === 0 ||
      startup.name.toLowerCase().includes(normalizedSearch) ||
      startupSector.toLowerCase().includes(normalizedSearch) ||
      (startup.description ?? "").toLowerCase().includes(normalizedSearch);
    const matchesSector = startupSectorFilter === "all" || startupSector.toLowerCase() === startupSectorFilter;
    const matchesEmployees = startupEmployeeFilter === "all" || (startup.employees?.trim() ?? "") === startupEmployeeFilter;
    return matchesSearch && matchesSector && matchesEmployees;
  });

  const displayedResources = filteredResources.filter((resource) => {
    const normalizedSearch = resourceSearchQuery.trim().toLowerCase();
    const categoryLabel = resource.category.replaceAll("_", " ").toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      resource.name.toLowerCase().includes(normalizedSearch) ||
      resource.description.toLowerCase().includes(normalizedSearch) ||
      categoryLabel.includes(normalizedSearch) ||
      resource.city.toLowerCase().includes(normalizedSearch) ||
      resource.state.toLowerCase().includes(normalizedSearch) ||
      resource.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
    const matchesCategory = resourceCategoryFilter === "all" || resource.category === resourceCategoryFilter;
    const matchesState = resourceStateFilter === "all" || resource.state.toLowerCase() === resourceStateFilter;
    return matchesSearch && matchesCategory && matchesState;
  });
  const selectedStartup = selectedStartupId ? startups.find((startup) => startup.id === selectedStartupId) ?? null : null;
  const selectedResource =
    selectedResourceId ? run.resources.find((resource) => resource.id === selectedResourceId) ?? null : null;

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
        <TabsContent value="overview" className="space-y-5">
          <Card className="rounded-2xl border border-border/70 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Profile summary</CardTitle>
              <Badge className="bg-secondary/15 text-secondary">{founderProfile.locationCity}</Badge>
            </div>
            <CardDescription className="mt-2">A quick snapshot of your current founder profile inputs.</CardDescription>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Stage</p>
                <p className="mt-1 text-sm font-semibold capitalize">{founderProfile.stage}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Industry</p>
                <p className="mt-1 text-sm font-semibold">{founderProfile.industry}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Funding status</p>
                <p className="mt-1 text-sm font-semibold">{founderProfile.fundingStatus}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Location</p>
                <p className="mt-1 text-sm font-semibold">{founderProfile.locationCity}</p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Idea</p>
                <p className="mt-1 text-sm text-foreground/90">{founderProfile.idea}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current challenge</p>
                <p className="mt-1 text-sm text-foreground/90">{founderProfile.challenge}</p>
              </div>
            </div>
          </Card>

          <section className="space-y-3 rounded-2xl border border-border/70 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <h4 className="text-base font-semibold">Priority recommendations</h4>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="icon" variant="ghost" onClick={onRetry} disabled={isRetrying}>
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                </Button>
                <Badge className="bg-secondary/15 text-secondary">{recommendations.length}</Badge>
              </div>
            </div>

            <div className="space-y-2.5">
              {recommendations.map((recommendation, index) => (
                <article key={recommendation.id} className="rounded-xl border border-border/70 bg-muted/35 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">#{index + 1} recommendation</p>
                      <p className="mt-1 text-base font-semibold">{recommendation.resourceName}</p>
                    </div>
                    <Badge className="bg-secondary/15 text-secondary">{recommendation.priority}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.reason}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/70 bg-background/45 p-4">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              <h4 className="text-base font-semibold">Needs and risk watchlist</h4>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Primary needs</p>
              <div className="flex flex-wrap gap-2">
                {analysis.primaryNeeds.map((need) => (
                  <Badge key={need}>{need.replaceAll("_", " ")}</Badge>
                ))}
              </div>
            </div>

            <ul className="space-y-2">
              {analysis.risks.map((risk) => (
                <li key={risk} className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                  {risk}
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-3">
            <div className="mb-2 flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Action roadmap</h4>
            </div>
            <RoadmapTaskManager run={run} />
        </TabsContent>

        <TabsContent value="startups" className="space-y-3">
          <AnimatePresence mode="wait" initial={false}>
            {selectedStartup ? (
              <motion.div
                key={`startup-detail-${selectedStartup.id}`}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onStartupClear?.()}
                    className="-ml-2 rounded-full px-3"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Startup profile</p>
                </div>

                <div className="flex flex-row h-fit justify-between rounded-2xl border border-border/70 bg-muted/35 p-4">
                  {(() => {
                    const startupLogoSource = resolveLogoSource(
                      selectedStartup.logoUrl,
                      selectedStartup.website,
                      selectedStartup.updatedAt,
                      true
                    );
                    const startupLogoSrc = startupLogoSource ?? undefined;
                    const logoKey = `${selectedStartup.id}:${selectedStartup.updatedAt ?? ""}`;
                    const showLogoImage = Boolean(startupLogoSrc) && !logoLoadFailures[logoKey];

                    return (
                      <div className="flex flex-row items-center h-fit w-full justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-11 w-11 shrink-0">
                            {!showLogoImage ? (
                              <div
                                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                                style={{ backgroundColor: getStartupAvatarColor(selectedStartup.name) }}
                                aria-hidden="true"
                              >
                                {getStartupInitial(selectedStartup.name)}
                              </div>
                            ) : null}
                            {showLogoImage ? (
                              <img
                                src={startupLogoSrc}
                                alt={`${selectedStartup.name} logo`}
                                className="absolute inset-0 h-11 w-11 rounded-full bg-background/70 object-contain"
                                loading="lazy"
                                onLoad={() => {
                                  setLogoLoadFailures((previous) => {
                                    if (!previous[logoKey]) {
                                      return previous;
                                    }

                                    const next = { ...previous };
                                    delete next[logoKey];
                                    return next;
                                  });
                                }}
                                onError={() => {
                                  setLogoLoadFailures((previous) => ({ ...previous, [logoKey]: true }));
                                }}
                              />
                            ) : null}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{selectedStartup.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{selectedStartup.sector ?? "Uncategorized"}</p>
                          </div>
                        </div>
                        {selectedStartup.employees ? (
                          <Badge className="bg-secondary/15 text-secondary">
                            <Users className="mr-1 h-3 w-3" />
                            {selectedStartup.employees}
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })()}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStartup.yearFounded ? (
                      <Badge className="border border-border/70 bg-background text-foreground">Founded {selectedStartup.yearFounded}</Badge>
                    ) : null}
                    {selectedStartup.hiringStatus ? (
                      <Badge className="border border-border/70 bg-background text-foreground">{selectedStartup.hiringStatus}</Badge>
                    ) : null}
                  </div>
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
              </motion.div>
            ) : (
              <motion.div
                key="startup-list"
                initial={{ opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 28 }}
                transition={{ duration: 0.22 }}
                className="space-y-3"
              >
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">Startup profiles</h4>
                  </div>

                  <div className="mb-3 rounded-xl border border-border/70 bg-background/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={startupSearchQuery}
                          onChange={(event) => setStartupSearchQuery(event.target.value)}
                          placeholder="Search startups"
                          className="h-9 rounded-lg border-border/70 bg-background pl-9 pr-3"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setStartupFiltersExpanded((current) => !current)}
                        className={cn(
                          "h-9 w-9 rounded-lg border border-border/70 bg-background",
                          startupFiltersExpanded && "border-primary/50 bg-primary/10 text-primary"
                        )}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </div>

                    <AnimatePresence initial={false}>
                      {startupFiltersExpanded ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2">
                            <Select
                              value={startupSectorFilter}
                              onValueChange={(value) => setStartupSectorFilter(value)}
                            >
                              <SelectTrigger className="h-9 flex-1 rounded-lg border-border/70 bg-background text-xs uppercase tracking-[0.1em] text-muted-foreground">
                                <SelectValue placeholder="All sectors" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All sectors</SelectItem>
                                {startupSectorOptions.map((sector) => (
                                  <SelectItem key={sector} value={sector.toLowerCase()}>
                                    {sector}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={startupEmployeeFilter}
                              onValueChange={(value) => setStartupEmployeeFilter(value)}
                            >
                              <SelectTrigger className="h-9 flex-1 rounded-lg border-border/70 bg-background text-xs uppercase tracking-[0.1em] text-muted-foreground">
                                <SelectValue placeholder="All sizes" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All sizes</SelectItem>
                                {startupEmployeeOptions.map((employees) => (
                                  <SelectItem key={employees} value={employees}>
                                    {employees}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {(startupSearchQuery || startupSectorFilter !== "all" || startupEmployeeFilter !== "all") ? (
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => {
                                  setStartupSearchQuery("");
                                  setStartupSectorFilter("all");
                                  setStartupEmployeeFilter("all");
                                }}
                                className="h-9 shrink-0 px-2 text-xs"
                              >
                                Clear
                              </Button>
                            ) : null}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {activeFilters && !activeFilters.clearFilters ? (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                      <Badge className="bg-primary/20 text-primary text-xs">
                        {displayedStartups.length} of {startups.length} matching
                      </Badge>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={onClearFilter}
                        className="ml-auto h-auto px-0 text-xs"
                      >
                        Clear filter
                      </Button>
                    </div>
                  ) : null}

                  <div className="mb-3 rounded-2xl border border-border/70 bg-muted/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Show startup pins</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Toggle startup pins on the map</p>
                      </div>
                      <Switch checked={showStartupPins} onCheckedChange={() => onToggleStartupPins()} />
                    </div>
                  </div>

                  {displayedStartups.length > 0 ? (
                    <div className="space-y-2">
                      {displayedStartups.map((startup) => {
                        const startupLogoSource = resolveLogoSource(
                          startup.logoUrl,
                          startup.website,
                          startup.updatedAt,
                          true
                        );
                        const startupLogoSrc = startupLogoSource ?? undefined;
                        const logoKey = `${startup.id}:${startup.updatedAt ?? ""}`;
                        const showLogoImage = Boolean(startupLogoSrc) && !logoLoadFailures[logoKey];

                        return (
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
                                  {!showLogoImage ? (
                                    <div
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                                      style={{ backgroundColor: getStartupAvatarColor(startup.name) }}
                                      aria-hidden="true"
                                    >
                                      {getStartupInitial(startup.name)}
                                    </div>
                                  ) : null}
                                  {showLogoImage ? (
                                    <img
                                      src={startupLogoSrc}
                                      alt={`${startup.name} logo`}
                                      className="absolute inset-0 h-8 w-8 rounded-full bg-background/70 object-contain"
                                      loading="lazy"
                                      onLoad={() => {
                                        setLogoLoadFailures((previous) => {
                                          if (!previous[logoKey]) {
                                            return previous;
                                          }

                                          const next = { ...previous };
                                          delete next[logoKey];
                                          return next;
                                        });
                                      }}
                                      onError={() => {
                                        setLogoLoadFailures((previous) => ({ ...previous, [logoKey]: true }));
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
                                  {startup.employees}
                                </Badge>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
                      {activeFilters && !activeFilters.clearFilters
                        ? "No startup profiles match the current filters."
                        : "No startup profiles match your search criteria."}
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
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            {selectedResource ? (
              <motion.div
                key={`resource-detail-${selectedResource.id}`}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onResourceClear?.()}
                    className="-ml-2 rounded-full px-3"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resource profile</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  {(() => {
                    const resourceLogoSource = resolveLogoSource(
                      selectedResource.logoUrl,
                      selectedResource.website,
                      selectedResource.updatedAt,
                      true
                    );
                    const resourceLogoSrc = resourceLogoSource ?? undefined;
                    const logoKey = `${selectedResource.id}:${selectedResource.updatedAt ?? ""}`;
                    const showLogoImage = Boolean(resourceLogoSrc) && !logoLoadFailures[logoKey];

                    return (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-11 w-11 shrink-0">
                            {!showLogoImage ? (
                              <div
                                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                                style={{ backgroundColor: getStartupAvatarColor(selectedResource.name) }}
                                aria-hidden="true"
                              >
                                {getStartupInitial(selectedResource.name)}
                              </div>
                            ) : null}
                            {showLogoImage ? (
                              <img
                                src={resourceLogoSrc}
                                alt={`${selectedResource.name} logo`}
                                className="absolute inset-0 h-11 w-11 rounded-full bg-background/70 object-contain"
                                loading="lazy"
                                onLoad={() => {
                                  setLogoLoadFailures((previous) => {
                                    if (!previous[logoKey]) {
                                      return previous;
                                    }

                                    const next = { ...previous };
                                    delete next[logoKey];
                                    return next;
                                  });
                                }}
                                onError={() => {
                                  setLogoLoadFailures((previous) => ({ ...previous, [logoKey]: true }));
                                }}
                              />
                            ) : null}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{selectedResource.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground capitalize">
                              {selectedResource.category.replaceAll("_", " ")}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-secondary/15 text-secondary capitalize">
                          {selectedResource.category.replaceAll("_", " ")}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Overview</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/90">{selectedResource.description}</p>
                </div>

                <div className="space-y-3">
                  {(selectedResource.address || selectedResource.city || selectedResource.state) ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/35 p-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Address</p>
                          <p className="mt-1 text-sm text-foreground">
                            {selectedResource.address ?? `${selectedResource.city}, ${selectedResource.state}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedResource.website ? (
                    <a
                      href={selectedResource.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted/55"
                    >
                      <div className="flex items-start gap-2">
                        <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Website</p>
                          <p className="mt-1 break-all">{selectedResource.website}</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </a>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="resource-list"
                initial={{ opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 28 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Founder resources</h4>
                </div>

                <div className="mb-3 rounded-xl border border-border/70 bg-background/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={resourceSearchQuery}
                        onChange={(event) => setResourceSearchQuery(event.target.value)}
                        placeholder="Search resources"
                        className="h-9 rounded-lg border-border/70 bg-background pl-9 pr-3"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setResourceFiltersExpanded((current) => !current)}
                      className={cn(
                        "h-9 w-9 rounded-lg border border-border/70 bg-background",
                        resourceFiltersExpanded && "border-primary/50 bg-primary/10 text-primary"
                      )}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </div>

                  <AnimatePresence initial={false}>
                    {resourceFiltersExpanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <Select
                            value={resourceCategoryFilter}
                            onValueChange={(value) => setResourceCategoryFilter(value)}
                          >
                            <SelectTrigger className="h-9 flex-1 rounded-lg border-border/70 bg-background text-xs uppercase tracking-[0.1em] text-muted-foreground">
                              <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All categories</SelectItem>
                              {resourceCategoryOptions.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category.replaceAll("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={resourceStateFilter}
                            onValueChange={(value) => setResourceStateFilter(value)}
                          >
                            <SelectTrigger className="h-9 flex-1 rounded-lg border-border/70 bg-background text-xs uppercase tracking-[0.1em] text-muted-foreground">
                              <SelectValue placeholder="All states" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All states</SelectItem>
                              {resourceStateOptions.map((state) => (
                                <SelectItem key={state} value={state.toLowerCase()}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(resourceSearchQuery || resourceCategoryFilter !== "all" || resourceStateFilter !== "all") ? (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              onClick={() => {
                                setResourceSearchQuery("");
                                setResourceCategoryFilter("all");
                                setResourceStateFilter("all");
                              }}
                              className="h-9 shrink-0 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          ) : null}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {activeFilters && !activeFilters.clearFilters ? (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                    <Badge className="bg-primary/20 text-primary text-xs">
                      {displayedResources.length} of {run.resources.length} matching
                    </Badge>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={onClearFilter}
                      className="ml-auto h-auto px-0 text-xs"
                    >
                      Clear filter
                    </Button>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Show resource pins</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Toggle pins on the map</p>
                    </div>
                    <Switch checked={showResourcePins} onCheckedChange={() => onToggleResourcePins()} />
                  </div>
                </div>

                <div className="space-y-2">
                  {displayedResources.map((resource) => {
                    const resourceLogoSource = resolveLogoSource(
                      resource.logoUrl,
                      resource.website,
                      resource.updatedAt,
                      true
                    );
                    const resourceLogoSrc = resourceLogoSource ?? undefined;
                    const logoKey = `${resource.id}:${resource.updatedAt ?? ""}`;
                    const showLogoImage = Boolean(resourceLogoSrc) && !logoLoadFailures[logoKey];

                    return (
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
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-8 w-8 shrink-0">
                            {!showLogoImage ? (
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                                style={{ backgroundColor: getStartupAvatarColor(resource.name) }}
                                aria-hidden="true"
                              >
                                {getStartupInitial(resource.name)}
                              </div>
                            ) : null}
                            {showLogoImage ? (
                              <img
                                src={resourceLogoSrc}
                                alt={`${resource.name} logo`}
                                className="absolute inset-0 h-8 w-8 rounded-full bg-background/70 object-contain"
                                loading="lazy"
                                onLoad={() => {
                                  setLogoLoadFailures((previous) => {
                                    if (!previous[logoKey]) {
                                      return previous;
                                    }

                                    const next = { ...previous };
                                    delete next[logoKey];
                                    return next;
                                  });
                                }}
                                onError={() => {
                                  setLogoLoadFailures((previous) => ({ ...previous, [logoKey]: true }));
                                }}
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{resource.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{resource.category.replaceAll("_", " ")}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {displayedResources.length === 0 ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
                    No resources match your search criteria.
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

    </aside>
  );
}
