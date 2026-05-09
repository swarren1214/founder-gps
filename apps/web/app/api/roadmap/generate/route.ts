import { NextRequest, NextResponse } from "next/server";
import {
  roadmapGenerateRequestSchema,
  roadmapGenerateResponseSchema,
  type RoadmapGenerateResponse,
  type StartupProfileData,
  type RoadmapTask,
  type RoadmapTaskPlan
} from "@/lib/schemas";
import { getAuthServiceUrl } from "@/lib/auth-service";

const ROADMAP_MODEL = process.env.OPENAI_ROADMAP_MODEL ?? process.env.AI_MODEL ?? "gpt-4o-mini";
const RESOURCE_SERVICE_URL = process.env.NEXT_PUBLIC_RESOURCE_SERVICE_URL ?? "http://localhost:4001";
const MODEL_TIMEOUT_MS = 20000;

function getChatCompletionsUrl(): string {
  const rawBaseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").trim();
  const normalizedBase = rawBaseUrl.replace(/\/+$/, "");

  if (/\/v1$/i.test(normalizedBase)) {
    return `${normalizedBase}/chat/completions`;
  }

  return `${normalizedBase}/v1/chat/completions`;
}

function makeTask(title: string, timeframe: "today" | "week" | "month", source: "ai" | "manual"): RoadmapTask {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    timeframe,
    completed: false,
    source,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeGeneratedTasks(raw: unknown, timeframe: "today" | "week" | "month"): RoadmapTask[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const title = String((item as Record<string, unknown>).title ?? "").trim();
      if (!title) {
        return null;
      }
      return makeTask(title, timeframe, "ai");
    })
    .filter((item): item is RoadmapTask => item !== null);
}

function parseModelJsonContent(content: string): Record<string, unknown> {
  const trimmed = content.trim();

  const candidates = [
    trimmed,
    trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Keep trying candidates.
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(sliced) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error("Model did not return valid JSON.");
}

async function callModelJson(params: {
  apiKey: string;
  temperature: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
}): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch(getChatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: ROADMAP_MODEL,
        temperature: params.temperature,
        response_format: { type: "json_object" },
        messages: params.messages
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${payload.slice(0, 240)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM returned an empty response.");
    }

    return parseModelJsonContent(content);
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractPreviousTaskTitles(onboardingContext: Record<string, unknown> | null): string[] {
  if (!onboardingContext || typeof onboardingContext !== "object") {
    return [];
  }

  const dashboardRoadmapTasks = (onboardingContext as Record<string, unknown>).dashboardRoadmapTasks;
  if (!dashboardRoadmapTasks || typeof dashboardRoadmapTasks !== "object") {
    return [];
  }

  const candidate = dashboardRoadmapTasks as Record<string, unknown>;
  const buckets = [candidate.today, candidate.week, candidate.month];
  const titles = buckets.flatMap((bucket) => {
    if (!Array.isArray(bucket)) {
      return [];
    }

    return bucket
      .map((item) => (item && typeof item === "object" ? String((item as Record<string, unknown>).title ?? "").trim() : ""))
      .filter((value) => value.length > 0);
  });

  return Array.from(new Set(titles));
}

async function generateWithLlm(input: {
  founderSummary: Record<string, unknown>;
  recommendations: Array<{ name: string; action: string; reason: string }>;
  resources: Array<{ name: string; category: string; city: string; summary: string }>;
  startups: Array<{ name: string; sector: string | null; size: string | null; description: string | null }>;
  onboardingContext: Record<string, unknown> | null;
  previousTaskTitles: string[];
}): Promise<RoadmapTaskPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Roadmap regeneration requires an LLM API key.");
  }

  const strategy = await callModelJson({
    apiKey,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content: [
          "You are a principal startup operator building execution systems for founders.",
          "Think deeply about constraints, sequencing, dependencies, and leverage.",
          "Return ONLY JSON with keys:",
          "- executionThesis: string",
          "- priorityLanes: string[] (3-5 lanes)",
          "- sequencingLogic: string[] (ordered steps)",
          "- blindSpots: string[] (2-5 risks)",
          "- leverageOpportunities: string[] (2-5 opportunities)",
          "- antiPatternsToAvoid: string[] (2-5 founder mistakes to avoid now)"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          founderSummary: input.founderSummary,
          onboardingContext: input.onboardingContext,
          recommendations: input.recommendations,
          resources: input.resources,
          startups: input.startups,
          previousTaskTitles: input.previousTaskTitles
        })
      }
    ]
  });

  const parsed = await callModelJson({
    apiKey,
    temperature: 0.45,
    messages: [
      {
        role: "system",
        content: [
          "You are converting strategy into a concrete execution backlog for a founder.",
          "Return ONLY JSON with keys today, week, month.",
          "Each key must be an array of objects with a single key: title.",
          "Constraints:",
          "- today: 3-5 tasks, each under 100 minutes, tangible output",
          "- week: 5-9 tasks, concrete execution milestones",
          "- month: 4-8 tasks, compounding outcomes",
          "- Include customer discovery, distribution/growth, and execution discipline",
          "- Avoid vague tasks like improve strategy, follow up, optimize later",
          "- Do NOT copy titles from previousTaskTitles. Produce materially different wording and actions",
          "- Prefer tasks with verbs and measurable completion criteria"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          founderSummary: input.founderSummary,
          strategy,
          topRecommendations: input.recommendations,
          previousTaskTitles: input.previousTaskTitles
        })
      }
    ]
  });

    const today = normalizeGeneratedTasks(parsed.today, "today");
    const week = normalizeGeneratedTasks(parsed.week, "week");
    const month = normalizeGeneratedTasks(parsed.month, "month");

    // De-duplicate task titles across timeframes to avoid repetitive plans.
    const seen = new Set<string>();
    const dedupe = (tasks: RoadmapTask[]) =>
      tasks.filter((task) => {
        const normalized = task.title.trim().toLowerCase();
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });

    const previousNormalized = new Set(input.previousTaskTitles.map((title) => title.trim().toLowerCase()));
    const filterPrevious = (tasks: RoadmapTask[]) =>
      tasks.filter((task) => !previousNormalized.has(task.title.trim().toLowerCase()));

    const dedupedToday = filterPrevious(dedupe(today));
    const dedupedWeek = filterPrevious(dedupe(week));
    const dedupedMonth = filterPrevious(dedupe(month));

    if (dedupedToday.length === 0 || dedupedWeek.length === 0 || dedupedMonth.length === 0) {
      throw new Error("LLM output was too repetitive or incomplete. Try regenerating again.");
    }

    return {
      today: dedupedToday,
      week: dedupedWeek,
      month: dedupedMonth,
      generatedAt: new Date().toISOString(),
      generatedFrom: "llm"
    };
}

async function fetchAuthOnboardingContext(request: NextRequest): Promise<Record<string, unknown> | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return null;
  }

  try {
    const response = await fetch(`${getAuthServiceUrl()}/auth/me`, {
      headers: {
        cookie,
        ...(request.headers.get("x-forwarded-for")
          ? { "x-forwarded-for": request.headers.get("x-forwarded-for") as string }
          : {}),
        ...(request.headers.get("x-real-ip") ? { "x-real-ip": request.headers.get("x-real-ip") as string } : {}),
        ...(request.headers.get("user-agent") ? { "user-agent": request.headers.get("user-agent") as string } : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      profile?: {
        onboardingContext?: Record<string, unknown>;
      };
    };

    return payload.profile?.onboardingContext ?? null;
  } catch {
    return null;
  }
}

async function fetchDatabaseStartups(input: {
  locationCity: string;
  startupsFromRequest?: StartupProfileData[];
}): Promise<Array<{ name: string; sector: string | null; size: string | null; description: string | null }>> {
  if (Array.isArray(input.startupsFromRequest) && input.startupsFromRequest.length > 0) {
    return input.startupsFromRequest.slice(0, 20).map((startup) => ({
      name: startup.name,
      sector: startup.sector,
      size: startup.employees,
      description: startup.description
    }));
  }

  try {
    const query = new URLSearchParams({ limit: "300" });
    if (input.locationCity) {
      query.set("city", input.locationCity);
    }

    const response = await fetch(`${RESOURCE_SERVICE_URL}/startups?${query.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { startups?: StartupProfileData[] };
    const startups = Array.isArray(payload.startups) ? payload.startups : [];

    return startups.slice(0, 20).map((startup) => ({
      name: startup.name,
      sector: startup.sector,
      size: startup.employees,
      description: startup.description
    }));
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = roadmapGenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const founderSummary = {
      location: parsed.data.founderProfile.locationCity,
      stage: parsed.data.analysis.stage,
      industry: parsed.data.analysis.industry,
      suggestedFocus: parsed.data.analysis.suggestedFocus,
      needs: parsed.data.analysis.primaryNeeds,
      challenge: parsed.data.founderProfile.challenge,
      idea: parsed.data.founderProfile.idea
    };

    const [onboardingContext, databaseStartups] = await Promise.all([
      fetchAuthOnboardingContext(request),
      fetchDatabaseStartups({
        locationCity: parsed.data.founderProfile.locationCity,
        startupsFromRequest: parsed.data.startups
      })
    ]);

    const topRecommendations = parsed.data.recommendations.slice(0, 6).map((item) => ({
      name: item.resourceName,
      action: item.recommendedAction,
      reason: item.reason
    }));

    const topResources = parsed.data.resources.slice(0, 10).map((resource) => ({
      name: resource.name,
      category: resource.category,
      city: resource.city,
      summary: resource.description
    }));

    const previousTaskTitles = extractPreviousTaskTitles(onboardingContext);

    const plan = await generateWithLlm({
      founderSummary,
      recommendations: topRecommendations,
      resources: topResources,
      startups: databaseStartups,
      onboardingContext,
      previousTaskTitles
    });

    const responsePayload: RoadmapGenerateResponse = { plan };
    return NextResponse.json(roadmapGenerateResponseSchema.parse(responsePayload));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate roadmap.";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
