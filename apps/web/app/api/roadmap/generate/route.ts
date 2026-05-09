import { NextRequest, NextResponse } from "next/server";
import {
  roadmapGenerateRequestSchema,
  roadmapGenerateResponseSchema,
  type RoadmapGenerateResponse,
  type RoadmapTask,
  type RoadmapTaskPlan
} from "@/lib/schemas";

const ROADMAP_MODEL = process.env.OPENAI_ROADMAP_MODEL ?? "gpt-4o-mini";
const MODEL_TIMEOUT_MS = 4500;

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

function fallbackPlan(input: {
  recommendations: Array<{ resourceName: string; recommendedAction: string }>;
}): RoadmapTaskPlan {
  const generatedAt = new Date().toISOString();
  const top = input.recommendations.slice(0, 3);

  return {
    today: [
      makeTask("Prioritize one milestone", "today", "manual")
    ],
    week: top.map((item) => makeTask(`Reach out: ${item.resourceName}`, "week", "manual")),
    month: [
      makeTask("Review progress and re-plan", "month", "manual")
    ],
    generatedAt,
    generatedFrom: "manual_seed"
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

async function generateWithLlm(input: {
  founderSummary: string;
  recommendations: Array<{ name: string; action: string; reason: string }>;
}): Promise<RoadmapTaskPlan | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: ROADMAP_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a founder execution planner. Return ONLY JSON with keys today, week, month. Each key must be an array of objects with title only. Keep tasks concrete and actionable."
          },
          {
            role: "user",
            content: JSON.stringify(input)
          }
        ]
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      today: normalizeGeneratedTasks(parsed.today, "today"),
      week: normalizeGeneratedTasks(parsed.week, "week"),
      month: normalizeGeneratedTasks(parsed.month, "month"),
      generatedAt: new Date().toISOString(),
      generatedFrom: "llm"
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
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

    const topRecommendations = parsed.data.recommendations.slice(0, 6).map((item) => ({
      name: item.resourceName,
      action: item.recommendedAction,
      reason: item.reason
    }));

    const generatedPlan = await generateWithLlm({
      founderSummary: JSON.stringify(founderSummary),
      recommendations: topRecommendations
    });

    const plan = generatedPlan ?? fallbackPlan({
      recommendations: parsed.data.recommendations.map((item) => ({
        resourceName: item.resourceName,
        recommendedAction: item.recommendedAction
      }))
    });

    const responsePayload: RoadmapGenerateResponse = { plan };
    return NextResponse.json(roadmapGenerateResponseSchema.parse(responsePayload));
  } catch {
    return NextResponse.json({ error: "Failed to generate roadmap." }, { status: 500 });
  }
}
