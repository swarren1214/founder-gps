"use client";

import { AlertTriangle, CheckSquare, Compass, RefreshCw, Route, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FounderFlowResponse } from "@/lib/schemas";

type DashboardControlsProps = {
  run: FounderFlowResponse;
  isRetrying: boolean;
  retryError: string | null;
  onRetry: () => void;
};

export function DashboardControls({ run, isRetrying, retryError, onRetry }: DashboardControlsProps) {
  const { founderProfile, analysis, recommendations, route, roadmap, warnings } = run;
  const roadmapTasks = roadmap
    ? roadmap.weeks.flatMap((week) =>
        week.tasks.map((task) => ({
          id: `${week.weekNumber}-${task.title}`,
          weekNumber: week.weekNumber,
          title: task.title,
          description: task.description
        }))
      )
    : [];

  return (
    <aside className="flex w-full h-full flex-col gap-4">
      <div className="bg-card p-5 h-full overflow-y-scroll">
        <Tabs defaultValue="overview" className="w-full flex-col gap-4">
          <TabsList className="grid h-9 w-full grid-cols-3 rounded-lg bg-muted p-1 text-muted-foreground">
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
              value="tasks"
              className="rounded-md px-3 py-1 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Tasks
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
                    <div className="flex items-start justify-between gap-3">
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

          <TabsContent value="tasks" className="space-y-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Action tasks</h4>
              </div>

              {roadmapTasks.length > 0 ? (
                <div className="space-y-2">
                  {roadmapTasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-border/70 bg-muted/35 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Week {task.weekNumber}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
                  No roadmap tasks yet. Generate or retry your founder run to populate tasks.
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recommendation actions</p>
              <div className="space-y-2">
                {recommendations.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-border/70 bg-muted/35 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Priority {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{item.resourceName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.recommendedAction}</p>
                  </div>
                ))}
              </div>
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
        </Tabs>
      </div>
    </aside>
  );
}
