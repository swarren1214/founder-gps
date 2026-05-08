import { describe, expect, it } from "vitest";
import { AiService } from "@founder-gps/ai";
import { buildApp } from "../src/app.js";
import type {
  AnalysisSnapshot,
  IntelligenceRepository
} from "../src/repository.js";

class InMemoryIntelligenceRepository implements IntelligenceRepository {
  private readonly snapshots = new Map<string, AnalysisSnapshot>();

  async saveFounderAnalysisSnapshot(params: {
    founderProfileId?: string | undefined;
    analysis: unknown;
    metadata: {
      provider: "openai" | "gemini" | "heuristic";
      model: string;
      promptVersion: string;
      latencyMs: number;
      tokensIn: number;
      tokensOut: number;
      fallbackUsed: boolean;
    };
  }): Promise<AnalysisSnapshot> {
    const id = crypto.randomUUID();
    const snapshot: AnalysisSnapshot = {
      id,
      founderProfileId: params.founderProfileId ?? null,
      analysisJson: params.analysis,
      provider: params.metadata.provider,
      model: params.metadata.model,
      promptVersion: params.metadata.promptVersion,
      latencyMs: params.metadata.latencyMs,
      tokensIn: params.metadata.tokensIn,
      tokensOut: params.metadata.tokensOut,
      fallbackUsed: params.metadata.fallbackUsed,
      createdAt: new Date().toISOString()
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  async getFounderAnalysisSnapshot(id: string): Promise<AnalysisSnapshot | null> {
    return this.snapshots.get(id) ?? null;
  }
}

describe("intelligence routes", () => {
  const app = buildApp({
    repository: new InMemoryIntelligenceRepository(),
    aiService: new AiService({ provider: "heuristic" })
  });

  it("returns valid founder analysis and metadata", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/intelligence/analyze-founder",
      payload: {
        location: "Lehi, UT",
        idea: "AI tool for service businesses",
        industry: "saas",
        stage: "idea",
        challenge: "I do not know where to begin",
        background: "Product manager"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.analysis.stage).toBe("validation");
    expect(Array.isArray(body.analysis.primaryNeeds)).toBe(true);
    expect(body.metadata.promptVersion).toBeTruthy();
    expect(body.snapshotId).toBeTruthy();
  });

  it("gracefully validates malformed payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/intelligence/analyze-founder",
      payload: {
        location: "",
        stage: "bad-stage"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("persists and reloads analysis snapshots", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/intelligence/analyze-founder",
      payload: {
        location: "Lehi, UT",
        idea: "B2B SaaS workflow tool",
        industry: "saas",
        stage: "validation",
        challenge: "Need better founder network",
        background: "Operator"
      }
    });

    const createBody = createResponse.json();
    const getResponse = await app.inject({
      method: "GET",
      url: `/intelligence/analysis/${createBody.snapshotId}`
    });

    expect(getResponse.statusCode).toBe(200);
    const snapshot = getResponse.json();
    expect(snapshot.id).toBe(createBody.snapshotId);
    expect(snapshot.analysisJson.suggestedFocus).toBeTruthy();
  });
});
