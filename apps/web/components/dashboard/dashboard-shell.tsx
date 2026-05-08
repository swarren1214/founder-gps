"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Compass, RefreshCw, Route, Sparkles } from "lucide-react";
import { founderFlowResponseSchema, type FounderFlowResponse } from "@/lib/schemas";
import { loadDashboardRun, saveDashboardRun } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FounderMap } from "@/components/map/founder-map";

function loadRun() {
  return founderFlowResponseSchema.safeParse(loadDashboardRun<FounderFlowResponse>());
}

export function DashboardShell() {
  const initialRun = loadRun();
  const [isRetrying, startTransition] = useTransition();
  const [run, setRun] = useState(() => (initialRun.success ? initialRun.data : null));
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!run) {
    return (
      <Card>
        <CardTitle>No founder run available</CardTitle>
        <CardDescription className="mt-3">
          Complete onboarding first to load your live analysis, recommendations, Founder Path, and roadmap.
        </CardDescription>
      </Card>
    );
  }

  async function retryRun() {
    if (!run) {
      return;
    }

    const currentRun = run;

    startTransition(async () => {
      try {
        setRetryError(null);
        trackEvent("founder_flow_retry_requested", {
          city: currentRun.founderProfile.locationCity,
          topN: currentRun.founderProfile.topN
        });

        const response = await fetch("/api/founder-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentRun.founderProfile)
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Retry failed.");
        }

        const parsed = founderFlowResponseSchema.parse(payload);
        saveDashboardRun(parsed);
        setRun(parsed);
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

  const { founderProfile, analysis, recommendations, route, roadmap, warnings, resources } = run;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="grid gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-[linear-gradient(135deg,rgba(17,32,59,0.96),rgba(15,106,116,0.82))] text-white">
            <Badge className="mb-4 border-white/20 bg-white/10 text-white">Founder dashboard</Badge>
            <CardTitle className="text-white">{founderProfile.locationCity} founder readiness snapshot</CardTitle>
            <CardDescription className="mt-3 text-white/72">
              {analysis.suggestedFocus}
            </CardDescription>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">Stage</p>
                <p className="mt-3 font-display text-3xl">{analysis.stage}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">Confidence</p>
                <p className="mt-3 font-display text-3xl">{Math.round(analysis.confidenceScore * 100)}%</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">Top route</p>
                <p className="mt-3 font-display text-3xl">{route ? `${route.totalDriveTimeMinutes}m` : "Pending"}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <CardTitle>Map and Founder Path</CardTitle>
                <CardDescription className="mt-2">
                  Ranked resources are highlighted on the map while the route layer shows your optimized Founder Path.
                </CardDescription>
              </div>
              {route ? <Badge>{route.totalDistanceMiles} miles</Badge> : null}
            </div>
            <FounderMap
              resources={resources}
              recommendations={recommendations}
              route={route}
              founderLocation={{
                city: founderProfile.locationCity,
                lat: founderProfile.locationLat,
                lng: founderProfile.locationLng
              }}
            />
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6">
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-ember" />
              <CardTitle>Recommendations</CardTitle>
            </div>
            <div className="space-y-4">
              {recommendations.map((recommendation, index) => (
                <div key={recommendation.id} className="rounded-3xl border border-ink/8 bg-white/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Rank {index + 1}</p>
                      <h4 className="mt-1 font-display text-xl">{recommendation.resourceName}</h4>
                    </div>
                    <Badge className="bg-ember/10 text-ember">{recommendation.priority}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/75">{recommendation.reason}</p>
                  <p className="mt-3 rounded-2xl bg-paper px-3 py-2 text-sm font-medium text-ink">{recommendation.recommendedAction}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <Compass className="h-5 w-5 text-lagoon" />
              <CardTitle>Needs and risks</CardTitle>
            </div>
            <div className="space-y-4 text-sm text-ink/75">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-ink/45">Primary needs</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.primaryNeeds.map((need) => (
                    <Badge key={need}>{need.replaceAll("_", " ")}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-ink/45">Risks</p>
                <ul className="space-y-2">
                  {analysis.risks.map((risk) => (
                    <li key={risk} className="rounded-2xl bg-[#fff2e9] px-3 py-2">{risk}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.16 }}>
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <Route className="h-5 w-5 text-ink" />
              <CardTitle>30-day roadmap</CardTitle>
            </div>
            {roadmap ? (
              <div className="space-y-4">
                {roadmap.weeks.map((week) => (
                  <div key={week.weekNumber} className="rounded-3xl border border-ink/8 bg-white/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Week {week.weekNumber}</p>
                    <h4 className="mt-1 font-display text-lg">{week.goal}</h4>
                    <ul className="mt-3 space-y-2 text-sm text-ink/75">
                      {week.tasks.map((task) => (
                        <li key={task.title} className="rounded-2xl bg-paper px-3 py-2">
                          <span className="font-semibold">{task.title}</span>
                          <span className="block text-ink/65">{task.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <CardDescription>No roadmap available yet.</CardDescription>
            )}
          </Card>
        </motion.div>

        {warnings.length > 0 || retryError ? (
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-[#f2c39b] bg-[#fff1e6]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-[#c45a17]" />
                  <CardTitle>Partial fallback state</CardTitle>
                </div>
                <Button variant="secondary" size="sm" onClick={retryRun} disabled={isRetrying} className="bg-[#11203b] text-white hover:bg-[#1b3158]">
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                  {isRetrying ? "Retrying" : "Retry services"}
                </Button>
              </div>
              <ul className="space-y-2 text-sm text-ink/76">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                {retryError ? <li key="retry-error">{retryError}</li> : null}
              </ul>
            </Card>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
