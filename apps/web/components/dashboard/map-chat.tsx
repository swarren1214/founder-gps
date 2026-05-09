"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { filterResources, filterStartups } from "@/lib/map-filters";
import type { FounderFlowResponse, MapFilters, ResourceCardData } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MapChatProps = {
  founderProfile: FounderFlowResponse["founderProfile"];
  analysis: FounderFlowResponse["analysis"];
  resources: ResourceCardData[];
  startups: FounderFlowResponse["startups"];
  onFilter: (filters: MapFilters) => void;
  onClearFilter: () => void;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type DistanceBounds = {
  maxDistanceMiles?: number;
  maxDurationMinutes?: number;
};

type DistanceFilterResult = {
  filters: MapFilters | undefined;
  usedProfileFallback: boolean;
};

type MatrixDestination = {
  id: string;
  coordinates: [number, number];
};

type MatrixRow = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
};

const ORS_MATRIX_BATCH_SIZE = 60;

function pluralize(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function extractEmployeeBounds(query: string): { employeeMin?: number; employeeMax?: number } | null {
  const normalized = query.toLowerCase();

  const betweenMatch = normalized.match(/between\s+(\d+)\s+and\s+(\d+)\s+employees?/i);
  if (betweenMatch) {
    const first = Number(betweenMatch[1]);
    const second = Number(betweenMatch[2]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      const min = Math.min(first, second);
      const max = Math.max(first, second);
      return { employeeMin: min, employeeMax: max };
    }
  }

  const minMatch = normalized.match(/(?:more than|over|greater than)\s+(\d+)\s+employees?/i);
  if (minMatch) {
    const value = Number(minMatch[1]);
    if (Number.isFinite(value)) {
      return { employeeMin: value + 1 };
    }
  }

  const minInclusiveMatch = normalized.match(/(?:at least|minimum of)\s+(\d+)\s+employees?/i);
  if (minInclusiveMatch) {
    const value = Number(minInclusiveMatch[1]);
    if (Number.isFinite(value)) {
      return { employeeMin: value };
    }
  }

  const maxMatch = normalized.match(/(?:less than|under|fewer than)\s+(\d+)\s+employees?/i);
  if (maxMatch) {
    const value = Number(maxMatch[1]);
    if (Number.isFinite(value)) {
      return { employeeMax: Math.max(1, value - 1) };
    }
  }

  const maxInclusiveMatch = normalized.match(/(?:at most|no more than)\s+(\d+)\s+employees?/i);
  if (maxInclusiveMatch) {
    const value = Number(maxInclusiveMatch[1]);
    if (Number.isFinite(value)) {
      return { employeeMax: value };
    }
  }

  return null;
}

function extractStates(query: string): string[] {
  const normalized = query.toLowerCase();
  const states: string[] = [];
  if (normalized.includes("utah") || /\but\b/.test(normalized)) {
    states.push("UT");
  }
  return states;
}

function extractStartupStageKeywords(query: string): string[] {
  const normalized = query.toLowerCase();
  const keywords = new Set<string>();
  const hasPreSeed = /\bpre[-\s]?seed\b/i.test(normalized);

  const stagePatterns: Array<[RegExp, string]> = [
    [/\bpre[-\s]?seed\b/i, "pre-seed"],
    [/\bseed\b/i, "seed"],
    [/\bseries\s*a\b/i, "series a"],
    [/\bseries\s*b\b/i, "series b"],
    [/\bseries\s*c\b/i, "series c"],
    [/\bseries\s*d\b/i, "series d"],
    [/\bgrowth\b/i, "growth"],
    [/\bbootstrapped\b/i, "bootstrapped"]
  ];

  for (const [pattern, value] of stagePatterns) {
    if (value === "seed" && hasPreSeed) {
      continue;
    }
    if (pattern.test(normalized)) {
      keywords.add(value);
    }
  }

  return Array.from(keywords);
}

function extractDistanceBounds(query: string): DistanceBounds | null {
  const normalized = query.toLowerCase();
  let maxDistanceMiles: number | undefined;
  let maxDurationMinutes: number | undefined;

  const distanceMatch = normalized.match(
    /(?:within|under|less than|fewer than|no more than|at most)\s+(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|kms?|km)\b/i
  );
  if (distanceMatch) {
    const value = Number(distanceMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      const unit = distanceMatch[2].toLowerCase();
      maxDistanceMiles = unit.startsWith("km") || unit.startsWith("kilometer") ? value * 0.621371 : value;
    }
  }

  const durationMatch = normalized.match(
    /(?:within|under|less than|fewer than|no more than|at most)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|min)\b/i
  );
  if (durationMatch) {
    const value = Number(durationMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      maxDurationMinutes = value;
    }
  }

  if (maxDistanceMiles === undefined && maxDurationMinutes === undefined) {
    return null;
  }

  return { maxDistanceMiles, maxDurationMinutes };
}

function queryRequestsCurrentLocation(query: string): boolean {
  return /\b(current location|my location|near me|around me|closest to me|from me|where i am)\b/i.test(query);
}

function getCurrentBrowserLocation(): Promise<[number, number] | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.longitude, position.coords.latitude]);
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000
      }
    );
  });
}

function chunkDestinations(destinations: MatrixDestination[], chunkSize: number): MatrixDestination[][] {
  const chunks: MatrixDestination[][] = [];
  for (let index = 0; index < destinations.length; index += chunkSize) {
    chunks.push(destinations.slice(index, index + chunkSize));
  }
  return chunks;
}

function normalizeIntentFromQuery(query: string, filters: MapFilters): MapFilters {
  const queryLower = query.toLowerCase();
  const asksStartups = /\bstartups?\b/.test(queryLower);
  const asksResources = /\bresources?\b/.test(queryLower);

  if (asksStartups && !asksResources) {
    return {
      ...filters,
      intent: "filter_startups",
      tab: "startups",
      resourceCategories: undefined,
      resourceStages: undefined
    };
  }

  if (asksResources && !asksStartups) {
    return {
      ...filters,
      intent: "filter_resources",
      tab: "resources",
      sectors: undefined,
      startupStageKeywords: undefined,
      employeeMin: undefined,
      employeeMax: undefined
    };
  }

  return filters;
}

function buildCountMessage(filters: MapFilters, resourceCount: number, startupCount: number): string | null {
  if (filters.clearFilters || filters.intent === "clear") {
    return null;
  }

  if (filters.intent === "filter_resources") {
    return `Showing ${pluralize(resourceCount, "resource", "resources")} matching your filters.`;
  }

  if (filters.intent === "filter_startups") {
    return `Showing ${pluralize(startupCount, "startup", "startups")} matching your filters.`;
  }

  if (filters.intent === "filter_both") {
    return `Showing ${pluralize(resourceCount, "resource", "resources")} and ${pluralize(startupCount, "startup", "startups")} matching your filters.`;
  }

  return null;
}

export function MapChat({
  founderProfile,
  analysis,
  resources,
  startups,
  onFilter,
  onClearFilter
}: MapChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<MapFilters | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract available categories and sectors
  const availableCategories = Array.from(new Set(resources.map((r) => r.category)));
  const availableSectors = Array.from(new Set(startups.map((s) => s.sector).filter(Boolean)));
  const availableStates = Array.from(new Set(resources.map((r) => r.state)));
  const availableEmployeeRanges = Array.from(new Set(startups.map((s) => s.employees).filter(Boolean)));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function applyDistanceFilter(query: string, filters: MapFilters | undefined): Promise<DistanceFilterResult> {
    const bounds = extractDistanceBounds(query);
    if (!bounds) {
      return { filters, usedProfileFallback: false };
    }

    const hasProfileOrigin =
      Number.isFinite(founderProfile.locationLng) &&
      Number.isFinite(founderProfile.locationLat);
    if (!hasProfileOrigin) {
      return { filters, usedProfileFallback: false };
    }

    let origin: [number, number] = [founderProfile.locationLng, founderProfile.locationLat];
    let usedProfileFallback = false;

    if (queryRequestsCurrentLocation(query)) {
      const browserLocation = await getCurrentBrowserLocation();
      if (browserLocation) {
        origin = browserLocation;
      } else {
        usedProfileFallback = true;
      }
    }

    const baseFilters: MapFilters =
      filters ?? {
        intent: "filter_both",
        tab: "overview"
      };

    const includeResources = baseFilters.intent !== "filter_startups";
    const includeStartups = baseFilters.intent !== "filter_resources";

    const preDistanceFilters: MapFilters = {
      ...baseFilters,
      nearbyResourceIds: undefined,
      nearbyStartupIds: undefined,
      maxDistanceMiles: undefined,
      maxDurationMinutes: undefined
    };

    const candidateResources = includeResources ? filterResources(resources, preDistanceFilters) : [];
    const candidateStartups = includeStartups ? filterStartups(startups, preDistanceFilters) : [];

    const destinations: MatrixDestination[] = [];
    if (includeResources) {
      destinations.push(
        ...candidateResources.map((resource) => ({
          id: `resource:${resource.id}`,
          coordinates: [resource.lng, resource.lat] as [number, number]
        }))
      );
    }

    if (includeStartups) {
      destinations.push(
        ...candidateStartups
          .filter((startup): startup is FounderFlowResponse["startups"][number] & { lat: number; lng: number } =>
            startup.lat !== null && startup.lng !== null
          )
          .map((startup) => ({
            id: `startup:${startup.id}`,
            coordinates: [startup.lng, startup.lat] as [number, number]
          }))
      );
    }

    if (destinations.length === 0) {
      return {
        filters: {
          ...baseFilters,
          maxDistanceMiles: bounds.maxDistanceMiles,
          maxDurationMinutes: bounds.maxDurationMinutes,
          nearbyResourceIds: includeResources ? [] : undefined,
          nearbyStartupIds: includeStartups ? [] : undefined
        },
        usedProfileFallback
      };
    }

    try {
      const destinationBatches = chunkDestinations(destinations, ORS_MATRIX_BATCH_SIZE);
      const collectedRows: MatrixRow[] = [];

      for (const batch of destinationBatches) {
        const response = await fetch("/api/routing/ors/matrix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destinations: batch })
        });

        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as {
          results?: Array<{ id: string; distanceMeters: number; durationSeconds: number }>;
        };

        const resultRows = Array.isArray(payload.results) ? payload.results : [];
        collectedRows.push(...resultRows);
      }

      const matchedResourceIds: string[] = [];
      const matchedStartupIds: string[] = [];

      for (const row of collectedRows) {
        if (!row || typeof row.id !== "string") {
          continue;
        }

        const distanceMiles = row.distanceMeters / 1609.344;
        const durationMinutes = row.durationSeconds / 60;
        const distancePass = bounds.maxDistanceMiles === undefined || distanceMiles <= bounds.maxDistanceMiles;
        const durationPass = bounds.maxDurationMinutes === undefined || durationMinutes <= bounds.maxDurationMinutes;
        if (!distancePass || !durationPass) {
          continue;
        }

        if (row.id.startsWith("resource:")) {
          matchedResourceIds.push(row.id.slice("resource:".length));
          continue;
        }

        if (row.id.startsWith("startup:")) {
          matchedStartupIds.push(row.id.slice("startup:".length));
        }
      }

      return {
        filters: {
          ...baseFilters,
          maxDistanceMiles: bounds.maxDistanceMiles,
          maxDurationMinutes: bounds.maxDurationMinutes,
          nearbyResourceIds: includeResources ? matchedResourceIds : undefined,
          nearbyStartupIds: includeStartups ? matchedStartupIds : undefined
        },
        usedProfileFallback
      };
    } catch {
      return { filters, usedProfileFallback };
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role: "user",
      content: input.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/map-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.content,
          founderSummary: `Stage: ${analysis.stage}; Confidence: ${Math.round(analysis.confidenceScore * 100)}%; Primary needs: ${analysis.primaryNeeds.join(", ")}; Location: ${founderProfile.locationCity}`,
          availableCategories,
          availableSectors,
          availableStates,
          availableEmployeeRanges
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const serverFilters = data.filters as MapFilters | undefined;
      const employeeBounds = extractEmployeeBounds(userMessage.content);
      const stateHints = extractStates(userMessage.content);
      const stageHints = extractStartupStageKeywords(userMessage.content);
      const filtersWithEmployeeBounds: MapFilters | undefined = employeeBounds
        ? {
            ...(serverFilters ?? {
              intent: "filter_startups",
              tab: "startups"
            }),
            ...employeeBounds
          }
        : serverFilters;
      const filtersWithStateBounds: MapFilters | undefined =
        stateHints.length > 0
          ? {
              ...(filtersWithEmployeeBounds ?? {
                intent: "filter_both",
                tab: "startups"
              }),
              states: Array.from(new Set([...(filtersWithEmployeeBounds?.states ?? []), ...stateHints]))
            }
          : filtersWithEmployeeBounds;
      const finalFilters: MapFilters | undefined =
        stageHints.length > 0
          ? {
              ...(filtersWithStateBounds ?? {
                intent: "filter_startups",
                tab: "startups"
              }),
              startupStageKeywords: Array.from(
                new Set([...(filtersWithStateBounds?.startupStageKeywords ?? []), ...stageHints])
              )
            }
          : filtersWithStateBounds;
      const normalizedFilters = finalFilters ? normalizeIntentFromQuery(userMessage.content, finalFilters) : undefined;
      const distanceFilterResult = await applyDistanceFilter(userMessage.content, normalizedFilters);
      const distanceAwareFilters = distanceFilterResult.filters;
      let reply = data.reply as string;

      if (distanceAwareFilters) {
        const resourceCount = filterResources(resources, distanceAwareFilters).length;
        const startupCount = filterStartups(startups, distanceAwareFilters).length;
        const countMessage = buildCountMessage(distanceAwareFilters, resourceCount, startupCount);
        if (countMessage) {
          reply = countMessage;
        }

        if (distanceFilterResult.usedProfileFallback) {
          reply = `${reply} I couldn't access your current location, so I used your saved profile location instead.`;
        }
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        role: "assistant",
        content: reply
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (distanceAwareFilters) {
        setActiveFilters(distanceAwareFilters);
        onFilter(distanceAwareFilters);
      }
    } catch (error) {
      console.error("Map chat error:", error);
      toast.error(error instanceof Error ? error.message : "Sorry, I encountered an error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilter = () => {
    setActiveFilters(null);
    onClearFilter();
  };

  return (
    <div className="fixed bottom-4 right-4 z-20">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.button
            key="fab"
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-white shadow-lg hover:bg-secondary/90 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="h-6 w-6" />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            initial={{ y: 400, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 right-0 w-[360px] max-h-[50vh] rounded-2xl border border-border/70 bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <h3 className="font-semibold text-sm">Map Assistant</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Active Filters Badge */}
            {activeFilters && !activeFilters.clearFilters ? (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2">
                <Badge className="bg-secondary/20 text-secondary text-xs">
                  Filter active
                </Badge>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="ml-auto text-xs font-medium text-secondary hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : null}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Ask me to filter resources and startups.</p>
                  <p className="mt-1 text-xs">"Show me Utah resources for funding"</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-xs px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-secondary text-white"
                          : "bg-muted text-foreground border border-border/50"
                      )}
                      style={{
                        borderRadius: message.role === "user" 
                          ? "0.85rem 0.85rem 0.3rem 0.85rem"
                          : "0.85rem 0.85rem 0.85rem 0.3rem"
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading ? (
                <div className="flex gap-2 justify-start">
                  <div className="bg-muted border border-border/50 rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce delay-100" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-border/50 p-2 flex gap-2 items-center"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for resources..."
                disabled={isLoading}
                className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              <Button
                type="submit"
                variant="default"
                disabled={!input.trim() || isLoading}
                className="shrink-0 p-2 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
