import { NextRequest, NextResponse } from "next/server";
import {
  roadmapSchema,
  roadmapGenerateRequestSchema,
  roadmapGenerateResponseSchema,
  type RoadmapGenerateResponse,
  type RoadmapTask,
  type RoadmapTaskPlan
} from "@/lib/schemas";
import { getIntelligenceServiceUrl } from "@/lib/service-urls";

const INTELLIGENCE_SERVICE_URL = getIntelligenceServiceUrl();

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


function buildPlanFromRoadmap(roadmap: { weeks: Array<{ weekNumber: number; tasks: Array<{ title: string }> }> }): RoadmapTaskPlan {
  const today: RoadmapTask[] = [];
  const week: RoadmapTask[] = [];
  const month: RoadmapTask[] = [];

  for (const roadmapWeek of roadmap.weeks) {
    const targetBucket = roadmapWeek.weekNumber <= 1 ? week : month;

    for (const task of roadmapWeek.tasks) {
      const title = task.title.trim();
      if (!title) {
        continue;
      }

      targetBucket.push(makeTask(title, roadmapWeek.weekNumber <= 1 ? "week" : "month", "ai"));

      // Seed "today" with a few immediate actions from the first week.
      if (roadmapWeek.weekNumber <= 1 && today.length < 4) {
        today.push(makeTask(title, "today", "ai"));
      }
    }
  }

  return {
    today,
    week,
    month,
    generatedAt: new Date().toISOString(),
    generatedFrom: "llm"
  };
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

    const intelligenceRecommendations =
      topRecommendations.length > 0
        ? topRecommendations.map((item) => `${item.name}: ${item.action}`)
        : [
            founderSummary.suggestedFocus
              ? `Prioritize this focus: ${founderSummary.suggestedFocus}`
              : "Prioritize customer discovery and measurable weekly outreach."
          ];

    const roadmapResponse = await fetch(`${INTELLIGENCE_SERVICE_URL}/intelligence/generate-roadmap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        founderProfileId: parsed.data.founderProfile.founderProfileId,
        founderSummary: `${founderSummary.location} founder building ${founderSummary.idea}`,
        stage: founderSummary.stage,
        needs: founderSummary.needs,
        recommendations: intelligenceRecommendations,
        constraints: [parsed.data.founderProfile.fundingStatus, founderSummary.challenge].filter(Boolean)
      }),
      cache: "no-store"
    });

    if (!roadmapResponse.ok) {
      const message = await roadmapResponse.text();
      throw new Error(`Roadmap service failed (${roadmapResponse.status}): ${message.slice(0, 240)}`);
    }

    const roadmapPayload = (await roadmapResponse.json()) as { roadmap?: unknown };
    const parsedRoadmap = roadmapSchema.safeParse(roadmapPayload.roadmap);
    if (!parsedRoadmap.success) {
      throw new Error("Roadmap service returned an invalid roadmap payload.");
    }

    const plan = buildPlanFromRoadmap(parsedRoadmap.data);

    const responsePayload: RoadmapGenerateResponse = { plan };
    return NextResponse.json(roadmapGenerateResponseSchema.parse(responsePayload));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate roadmap.";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
