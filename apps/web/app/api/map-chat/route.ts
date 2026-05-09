import { NextRequest, NextResponse } from "next/server";

type MapChatRequest = {
  query: string;
  founderSummary:
    | string
    | {
      stage?: string;
      confidenceScore?: number;
      primaryNeeds?: string[];
      location?: string;
    };
  availableCategories: string[];
  availableSectors: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MapChatRequest;

    if (!body.query || !body.founderSummary || !body.availableCategories || !body.availableSectors) {
      return NextResponse.json(
        { error: "Missing required fields: query, founderSummary, availableCategories, availableSectors" },
        { status: 400 }
      );
    }

    const founderSummary =
      typeof body.founderSummary === "string"
        ? body.founderSummary
        : [
          body.founderSummary.stage ? `Stage: ${body.founderSummary.stage}` : null,
          typeof body.founderSummary.confidenceScore === "number"
            ? `Confidence: ${Math.round(body.founderSummary.confidenceScore * 100)}%`
            : null,
          Array.isArray(body.founderSummary.primaryNeeds) && body.founderSummary.primaryNeeds.length > 0
            ? `Primary needs: ${body.founderSummary.primaryNeeds.join(", ")}`
            : null,
          body.founderSummary.location ? `Location: ${body.founderSummary.location}` : null
        ]
          .filter(Boolean)
          .join("; ");

    if (!founderSummary.trim()) {
      return NextResponse.json(
        { error: "Invalid founderSummary" },
        { status: 400 }
      );
    }

    const intelligenceServiceUrl = process.env.INTELLIGENCE_SERVICE_URL || "http://localhost:4003";

    const response = await fetch(`${intelligenceServiceUrl}/intelligence/map-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: body.query,
        founderSummary,
        availableCategories: body.availableCategories,
        availableSectors: body.availableSectors
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Intelligence service error:", {
        status: response.status,
        url: `${intelligenceServiceUrl}/intelligence/map-chat`,
        body: error
      });
      return NextResponse.json(
        { error: "Intelligence service failed" },
        { status: response.status }
      );
    }

    const data = await response.json() as {
      filters: {
        reply: string;
        intent: string;
        tab?: string;
        resourceCategories?: string[];
        keywords?: string[];
        sectors?: string[];
        states?: string[];
        clearFilters?: boolean;
      };
      metadata: unknown;
    };

    return NextResponse.json({
      reply: data.filters.reply,
      filters: {
        intent: data.filters.intent,
        tab: data.filters.tab,
        resourceCategories: data.filters.resourceCategories,
        keywords: data.filters.keywords,
        sectors: data.filters.sectors,
        states: data.filters.states,
        clearFilters: data.filters.clearFilters
      }
    });
  } catch (error) {
    console.error("Map chat error:", error);
    return NextResponse.json({ error: "Map chat failed" }, { status: 500 });
  }
}
