"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, CalendarRange, GripVertical, Plus, Sparkles, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import type { FounderFlowResponse, RoadmapGenerateResponse, RoadmapTask, RoadmapTaskPlan } from "@/lib/schemas";
import { roadmapGenerateResponseSchema } from "@/lib/schemas";

type Timeframe = "today" | "week" | "month";

const TIMEFRAME_ORDER: Timeframe[] = ["today", "week", "month"];

const TIMEFRAME_META: Record<
  Timeframe,
  { title: string; subtitle: string; icon: typeof Sun; badgeClassName: string }
> = {
  today: {
    title: "Tasks For Today",
    subtitle: "High-leverage moves to finish before day-end.",
    icon: Sun,
    badgeClassName: "bg-amber-500/15 text-amber-600"
  },
  week: {
    title: "Tasks For This Week",
    subtitle: "Execution items that move your current milestone.",
    icon: CalendarRange,
    badgeClassName: "bg-sky-500/15 text-sky-600"
  },
  month: {
    title: "Tasks For This Month",
    subtitle: "Bigger outcomes to stabilize momentum.",
    icon: CalendarDays,
    badgeClassName: "bg-emerald-500/15 text-emerald-600"
  }
};

function makeTask(title: string, timeframe: Timeframe): RoadmapTask {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    timeframe,
    completed: false,
    source: "manual",
    createdAt: now,
    updatedAt: now
  };
}

function buildInitialPlan(run: FounderFlowResponse): RoadmapTaskPlan {
  const generatedAt = new Date().toISOString();
  const weekTasks = run.roadmap?.weeks.flatMap((week) =>
    week.tasks.map((task) => {
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        title: task.title,
        timeframe: week.weekNumber <= 1 ? ("week" as const) : ("month" as const),
        completed: false,
        source: "manual" as const,
        createdAt: now,
        updatedAt: now
      };
    })
  ) ?? [];

  return {
    today: [
      {
        id: crypto.randomUUID(),
        title: "Review priorities",
        timeframe: "today",
        completed: false,
        source: "manual",
        createdAt: generatedAt,
        updatedAt: generatedAt
      }
    ],
    week: weekTasks.filter((task) => task.timeframe === "week"),
    month: weekTasks.filter((task) => task.timeframe === "month"),
    generatedAt,
    generatedFrom: "legacy_roadmap"
  };
}

function SortableTaskItem({
  task,
  timeframe,
  onToggle,
  onEdit,
  onDelete
}: {
  task: RoadmapTask;
  timeframe: Timeframe;
  onToggle: (timeframe: Timeframe, id: string) => void;
  onEdit: (timeframe: Timeframe, id: string, title: string) => void;
  onDelete: (timeframe: Timeframe, id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border p-3 transition-colors ${
        task.completed ? "border-emerald-500/35 bg-emerald-500/5" : "border-border/70 bg-background/85"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(timeframe, task.id)}
          className="h-4 w-4 rounded border-border accent-emerald-600"
        />
        <input
          value={task.title}
          onChange={(event) => onEdit(timeframe, task.id, event.target.value)}
          className={`flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold outline-none focus:border-border/60 ${
            task.completed ? "line-through text-muted-foreground/80" : "text-foreground"
          }`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(timeframe, task.id)}
          className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function RoadmapTaskManager({ run }: { run: FounderFlowResponse }) {
  const [plan, setPlan] = useState<RoadmapTaskPlan>(() => buildInitialPlan(run));
  const [newTaskTitle, setNewTaskTitle] = useState<Record<Timeframe, string>>({ today: "", week: "", month: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalCount = useMemo(
    () => plan.today.length + plan.week.length + plan.month.length,
    [plan.today.length, plan.week.length, plan.month.length]
  );

  const completedCount = useMemo(
    () => [...plan.today, ...plan.week, ...plan.month].filter((task) => task.completed).length,
    [plan.today, plan.week, plan.month]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedPlan() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          profile?: { onboardingContext?: Record<string, unknown> };
        };

        const context = payload.profile?.onboardingContext;
        if (!context || typeof context !== "object") {
          return;
        }

        const candidate = (context as Record<string, unknown>).dashboardRoadmapTasks;
        if (!candidate || typeof candidate !== "object") {
          return;
        }

        const safe = candidate as Record<string, unknown>;
        const nextPlan: RoadmapTaskPlan = {
          today: Array.isArray(safe.today) ? (safe.today as RoadmapTask[]) : [],
          week: Array.isArray(safe.week) ? (safe.week as RoadmapTask[]) : [],
          month: Array.isArray(safe.month) ? (safe.month as RoadmapTask[]) : [],
          generatedAt: typeof safe.generatedAt === "string" ? safe.generatedAt : new Date().toISOString(),
          generatedFrom:
            safe.generatedFrom === "llm" || safe.generatedFrom === "manual_seed" || safe.generatedFrom === "legacy_roadmap"
              ? safe.generatedFrom
              : "legacy_roadmap"
        };

        if (!cancelled) {
          setPlan(nextPlan);
        }
      } catch {
        // Ignore load failures and continue with local plan.
      }
    }

    void loadPersistedPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  async function persistPlan(nextPlan: RoadmapTaskPlan) {
    setIsSaving(true);
    try {
      const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
      if (!meResponse.ok) {
        throw new Error("Unable to load profile for roadmap persistence.");
      }

      const mePayload = (await meResponse.json()) as {
        profile?: { onboardingContext?: Record<string, unknown> };
      };

      const existingContext = mePayload.profile?.onboardingContext ?? {};
      const existingSchemaVersion =
        typeof existingContext.schemaVersion === "number" && Number.isFinite(existingContext.schemaVersion)
          ? existingContext.schemaVersion
          : 1;

      const patchResponse = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingContext: {
            ...existingContext,
            schemaVersion: existingSchemaVersion,
            dashboardRoadmapTasks: nextPlan
          }
        })
      });

      if (!patchResponse.ok) {
        throw new Error("Unable to save roadmap tasks.");
      }
    } catch (persistError) {
      setError(persistError instanceof Error ? persistError.message : "Unable to save roadmap tasks.");
    } finally {
      setIsSaving(false);
    }
  }

  function updatePlan(nextPlan: RoadmapTaskPlan) {
    setPlan(nextPlan);
    void persistPlan(nextPlan);
  }

  async function generateRoadmap() {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/roadmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founderProfile: run.founderProfile,
          analysis: run.analysis,
          recommendations: run.recommendations,
          resources: run.resources,
          startups: run.startups
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Roadmap generation failed.");
      }

      const parsed = roadmapGenerateResponseSchema.parse(payload as RoadmapGenerateResponse);
      updatePlan(parsed.plan);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate roadmap.");
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleTask(timeframe: Timeframe, id: string) {
    const now = new Date().toISOString();
    const nextPlan: RoadmapTaskPlan = {
      ...plan,
      [timeframe]: plan[timeframe].map((task) =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
              updatedAt: now
            }
          : task
      )
    };
    updatePlan(nextPlan);
  }

  function deleteTask(timeframe: Timeframe, id: string) {
    const nextPlan: RoadmapTaskPlan = {
      ...plan,
      [timeframe]: plan[timeframe].filter((task) => task.id !== id)
    };
    updatePlan(nextPlan);
  }

  function editTask(timeframe: Timeframe, id: string, title: string) {
    const now = new Date().toISOString();
    const nextPlan: RoadmapTaskPlan = {
      ...plan,
      [timeframe]: plan[timeframe].map((task) =>
        task.id === id
          ? {
              ...task,
              title,
              updatedAt: now
            }
          : task
      )
    };
    updatePlan(nextPlan);
  }

  function addTask(timeframe: Timeframe) {
    const title = newTaskTitle[timeframe].trim();
    if (!title) {
      return;
    }

    const nextPlan: RoadmapTaskPlan = {
      ...plan,
      [timeframe]: [...plan[timeframe], makeTask(title, timeframe)]
    };

    setNewTaskTitle((current) => ({ ...current, [timeframe]: "" }));
    updatePlan(nextPlan);
  }

  function handleDragEnd(timeframe: Timeframe, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = plan[timeframe];
    const oldIndex = items.findIndex((t) => t.id === active.id);
    const newIndex = items.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    updatePlan({ ...plan, [timeframe]: arrayMove(items, oldIndex, newIndex) });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-[linear-gradient(145deg,rgba(16,24,40,0.04),rgba(8,145,178,0.04))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Founder execution plan</p>
            <h5 className="mt-1 text-lg font-semibold text-foreground">Action roadmap</h5>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {completedCount} of {totalCount} complete
              {totalCount > 0 ? ` (${Math.round((completedCount / totalCount) * 100)}%)` : ""}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={generateRoadmap}
            disabled={isGenerating}
            className="shrink-0 rounded-full px-4"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Generating..." : "Regenerate"}
          </Button>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#0ea5e9)] transition-[width] duration-300"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {error ? <CardDescription className="text-destructive">{error}</CardDescription> : null}
      {isSaving ? <CardDescription>Saving roadmap changes...</CardDescription> : null}

      {TIMEFRAME_ORDER.map((timeframe) => (
        <div key={timeframe} className="rounded-2xl border border-border/70 bg-muted/30 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {(() => {
                const MetaIcon = TIMEFRAME_META[timeframe].icon;
                return <MetaIcon className="h-4 w-4 text-primary" />;
              })()}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{TIMEFRAME_META[timeframe].title}</p>
                <p className="text-xs text-muted-foreground">{TIMEFRAME_META[timeframe].subtitle}</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${TIMEFRAME_META[timeframe].badgeClassName}`}
            >
              {plan[timeframe].filter((task) => task.completed).length}/{plan[timeframe].length}
            </span>
          </div>

          <div className="space-y-2.5">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(timeframe, event)}
            >
              <SortableContext
                items={plan[timeframe].map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {plan[timeframe].map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    timeframe={timeframe}
                    onToggle={toggleTask}
                    onEdit={editTask}
                    onDelete={deleteTask}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {plan[timeframe].length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-background/50 p-3 text-sm text-muted-foreground">
                No tasks yet for this timeframe.
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              value={newTaskTitle[timeframe]}
              onChange={(event) =>
                setNewTaskTitle((current) => ({
                  ...current,
                  [timeframe]: event.target.value
                }))
              }
              placeholder="Add a new task"
              className="h-10 flex-1 rounded-lg border border-border/80 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => addTask(timeframe)}
              className="h-10 w-10 p-4"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
