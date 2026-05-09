import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "../app/api/chat/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chat route", () => {
  it("forwards valid chat requests and preserves the structured response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            responseMarkdown: "## Founder update\n\nKeep going.",
            responsePayload: {
              kind: "chat",
              intent: "recommend",
              cards: [],
              actions: [],
              summary: "Grounded response"
            },
            citations: [],
            suggestions: ["Ask for a roadmap"],
            metadata: { provider: "heuristic" },
            sessionId: "session-1",
            contextSummary: "summary"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          userId: "3d5a3a1c-5d6f-4c2d-8f15-1d4f7de4d8f1",
          message: "What should I do next?",
          stylePrefs: {
            tone: "strategic",
            emojiMode: "off",
            verbosity: "standard"
          }
        })
      }) as unknown as NextRequest
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.responseMarkdown).toContain("Founder update");
    expect(body.responsePayload.intent).toBe("recommend");
    expect(body.requestId).toBeTruthy();
  });

  it("rejects malformed chat requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "",
          message: ""
        })
      }) as unknown as NextRequest
    );

    expect(response.status).toBe(400);
  });
});
