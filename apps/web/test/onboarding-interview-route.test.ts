import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/onboarding/interview/route";

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("onboarding interview route", () => {
  it("returns first deterministic question when transcript is empty", async () => {
    const request = new Request("http://localhost/api/onboarding/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turns: [] })
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.completed).toBe(false);
    expect(body.source).toBe("deterministic");
    expect(body.nextQuestion.toLowerCase()).toContain("problem");
  });

  it("falls back to deterministic output when model call fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network failure"));

    const request = new Request("http://localhost/api/onboarding/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        turns: [
          {
            question: "What motivates you to build this company?",
            answer: "I want to improve home health follow-up with better care coordination."
          }
        ]
      })
    });

    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.source).toBe("deterministic");
    expect(body.completed).toBe(false);
    expect(body.nextQuestion).toBeTruthy();
  });

  it("falls back to deterministic output when model call times out", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.useFakeTimers();

    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      }) as Promise<Response>;
    });

    const request = new Request("http://localhost/api/onboarding/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turns: [] })
    });

    const responsePromise = POST(request as never);
    await vi.advanceTimersByTimeAsync(4100);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("deterministic");
    expect(body.completed).toBe(false);
    expect(body.nextQuestion).toBeTruthy();
  });
});
