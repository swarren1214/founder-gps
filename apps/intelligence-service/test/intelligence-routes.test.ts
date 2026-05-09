import { describe, expect, it } from "vitest";
import { AiService } from "@founder-gps/ai";
import { RESOURCE_CATEGORIES } from "@founder-gps/shared-types";
import { buildApp } from "../src/app.js";
import type {
  AnalysisSnapshot,
  ChatContextSnapshotRecord,
  ChatCitation,
  ChatMessageRecord,
  ChatSessionRecord,
  FounderProfileRecord,
  IntelligenceRepository
} from "../src/repository.js";

class InMemoryIntelligenceRepository implements IntelligenceRepository {
  public readonly seedUserId: string;
  private readonly snapshots = new Map<string, AnalysisSnapshot>();
  private readonly founderProfiles = new Map<string, FounderProfileRecord>();
  private readonly sessions = new Map<string, ChatSessionRecord>();
  private readonly messages: ChatMessageRecord[] = [];
  private readonly contextSnapshots: ChatContextSnapshotRecord[] = [];

  constructor() {
    this.seedUserId = crypto.randomUUID();

    const founderProfile: FounderProfileRecord = {
      id: crypto.randomUUID(),
      userId: this.seedUserId,
      locationCity: "Lehi",
      locationLat: 40.3916,
      locationLng: -111.8508,
      startupIdea: "AI workflow copilot for service businesses",
      industry: "saas",
      stage: "validation",
      biggestChallenge: "Need customer discovery and founder network",
      fundingStatus: "bootstrapped",
      founderBackground: "Product operator with field experience",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.founderProfiles.set(this.seedUserId, founderProfile);

    const snapshotId = crypto.randomUUID();
    this.snapshots.set(snapshotId, {
      id: snapshotId,
      founderProfileId: founderProfile.id,
      analysisJson: {
        stage: "validation",
        primaryNeeds: ["customer_discovery"],
        secondaryNeeds: ["mentor_network"],
        industry: "saas",
        founderType: "product_led_operator",
        confidenceScore: 0.81,
        suggestedFocus: "Validate urgent pain before building more scope.",
        risks: ["Building too early"]
      },
      provider: "heuristic",
      model: "heuristic-v1",
      promptVersion: "test",
      latencyMs: 10,
      tokensIn: 10,
      tokensOut: 10,
      fallbackUsed: false,
      createdAt: new Date().toISOString()
    });
  }

  async saveFounderAnalysisSnapshot(params: {
    founderProfileId?: string;
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

  async getLatestFounderAnalysisSnapshotByFounderProfileId(
    founderProfileId: string
  ): Promise<AnalysisSnapshot | null> {
    const snapshots = Array.from(this.snapshots.values()).reverse();
    return snapshots.find((snapshot) => snapshot.founderProfileId === founderProfileId) ?? null;
  }

  async getFounderProfileByUserId(userId: string): Promise<FounderProfileRecord | null> {
    return this.founderProfiles.get(userId) ?? null;
  }

  async createChatSession(params: { id?: string; userId: string }): Promise<ChatSessionRecord> {
    const id = params.id ?? crypto.randomUUID();
    const session: ChatSessionRecord = {
      id,
      userId: params.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(id, session);
    return session;
  }

  async getChatSession(id: string): Promise<ChatSessionRecord | null> {
    return this.sessions.get(id) ?? null;
  }

  async appendChatMessage(params: {
    sessionId: string;
    role: "user" | "assistant" | "tool";
    content: string;
    citations?: ChatCitation[];
    toolInvocations?: unknown[];
  }): Promise<ChatMessageRecord> {
    const message: ChatMessageRecord = {
      id: crypto.randomUUID(),
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      citations: params.citations ?? [],
      toolInvocations: params.toolInvocations ?? [],
      createdAt: new Date().toISOString()
    };

    this.messages.push(message);
    return message;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessageRecord[]> {
    return this.messages.filter((message) => message.sessionId === sessionId);
  }

  async saveChatContextSnapshot(params: {
    sessionId: string;
    bundleHash: string;
    bundleJson: unknown;
  }): Promise<ChatContextSnapshotRecord> {
    const snapshot: ChatContextSnapshotRecord = {
      id: crypto.randomUUID(),
      sessionId: params.sessionId,
      bundleHash: params.bundleHash,
      bundleJson: params.bundleJson,
      createdAt: new Date().toISOString()
    };

    this.contextSnapshots.push(snapshot);
    return snapshot;
  }

  async getChatContextSnapshots(sessionId: string): Promise<ChatContextSnapshotRecord[]> {
    return this.contextSnapshots.filter((snapshot) => snapshot.sessionId === sessionId);
  }
}

function buildMockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const href = String(input);

    if (href.includes("/recommendations/replay/")) {
      return new Response(
        JSON.stringify({
          recommendations: [
            {
              id: crypto.randomUUID(),
              resourceId: crypto.randomUUID(),
              resourceName: "Utah Founders Network",
              score: 92,
              priority: "high",
              reason: "Strong fit for validation-stage founders.",
              recommendedAction: "Join the next meetup."
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (href.includes("/resources?")) {
      return new Response(
        JSON.stringify({
          resources: [
            {
              id: crypto.randomUUID(),
              name: "Launch House",
              category: RESOURCE_CATEGORIES[0],
              description: "A founder community.",
              website: "https://example.com",
              logoUrl: null,
              address: null,
              city: "Lehi",
              state: "UT",
              lat: 40.39,
              lng: -111.85,
              stageFit: ["validation"],
              industryFit: ["saas"],
              tags: ["community"],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          count: 1
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (href.includes("/startups?")) {
      return new Response(
        JSON.stringify({
          startups: [
            {
              id: crypto.randomUUID(),
              name: "Neighborly",
              website: null,
              logoUrl: null,
              employees: "11-50",
              sector: "saas",
              yearFounded: 2020,
              linkedin: null,
              description: "Local startup example.",
              address: "Lehi, UT",
              hiringStatus: null,
              jobPostings: [],
              photoGallery: [],
              lat: 40.39,
              lng: -111.85,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          count: 1
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

function buildFailingDependencyFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const href = String(input);
    if (
      href.includes("/recommendations/replay/") ||
      href.includes("/resources?") ||
      href.includes("/startups?")
    ) {
      return new Response("unavailable", { status: 503 });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("intelligence routes", () => {
  const repository = new InMemoryIntelligenceRepository();
  const app = buildApp({
    repository,
    aiService: new AiService({ provider: "heuristic" }),
    resourceServiceUrl: "http://resource.test",
    recommendationServiceUrl: "http://recommendation.test",
    fetchImpl: buildMockFetch()
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

  it("creates a grounded chat response and persists the transcript", async () => {
    const sessionId = crypto.randomUUID();
    const response = await app.inject({
      method: "POST",
      url: "/intelligence/chat",
      payload: {
        sessionId,
        userId: repository.seedUserId,
        message: "What should I do next?",
        stylePrefs: {
          tone: "strategic",
          emojiMode: "off",
          verbosity: "standard"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.responseMarkdown).toContain("Lehi founder update");
    expect(body.responsePayload.intent).toBe("recommend");
    expect(body.citations.length).toBeGreaterThan(0);
    expect(body.sessionId).toBe(sessionId);
    expect(body.contextSummary).toContain("founder");

    const historyResponse = await app.inject({
      method: "GET",
      url: `/intelligence/chat/session/${sessionId}?userId=${repository.seedUserId}`
    });

    expect(historyResponse.statusCode).toBe(200);
    const history = historyResponse.json();
    expect(history.messageCount).toBe(2);
    expect(history.snapshotCount).toBe(1);
    expect(history.messages[0].role).toBe("user");
    expect(history.messages[1].role).toBe("assistant");
  });

  it("denies chat history access when user does not own the session", async () => {
    const sessionId = crypto.randomUUID();
    const createResponse = await app.inject({
      method: "POST",
      url: "/intelligence/chat",
      payload: {
        sessionId,
        userId: repository.seedUserId,
        message: "Show my history"
      }
    });

    expect(createResponse.statusCode).toBe(200);

    const otherUserId = crypto.randomUUID();
    const historyResponse = await app.inject({
      method: "GET",
      url: `/intelligence/chat/session/${sessionId}?userId=${otherUserId}`
    });

    expect(historyResponse.statusCode).toBe(401);
  });

  it("returns a safe degraded response when dependencies are unavailable", async () => {
    const degradedApp = buildApp({
      repository,
      aiService: new AiService({ provider: "heuristic" }),
      resourceServiceUrl: "http://resource.test",
      recommendationServiceUrl: "http://recommendation.test",
      fetchImpl: buildFailingDependencyFetch()
    });

    const response = await degradedApp.inject({
      method: "POST",
      url: "/intelligence/chat",
      payload: {
        sessionId: crypto.randomUUID(),
        userId: repository.seedUserId,
        message: "What can I do if data is missing?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.responseMarkdown).toContain("unavailable right now");
    expect(body.responsePayload.summary).toContain("founder");
  });
});
