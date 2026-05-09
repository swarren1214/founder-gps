import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter, normalizeRateLimitKey } from "../src/rate-limit.js";

describe("rate limit helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes empty and mixed-case keys", () => {
    expect(normalizeRateLimitKey("  Example@Email.com  ")).toBe("example@email.com");
    expect(normalizeRateLimitKey("")).toBe("unknown");
  });

  it("enforces a token bucket window", () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

    expect(limiter.allow("login:ip-1")).toBe(true);
    expect(limiter.allow("login:ip-1")).toBe(true);
    expect(limiter.allow("login:ip-1")).toBe(false);

    vi.advanceTimersByTime(500);
    expect(limiter.allow("login:ip-1")).toBe(true);
  });

  it("resets individual keys and the full bucket set", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });

    expect(limiter.allow("register:ip-1")).toBe(true);
    expect(limiter.allow("register:ip-1")).toBe(false);

    limiter.reset("register:ip-1");
    expect(limiter.allow("register:ip-1")).toBe(true);

    limiter.allow("register:ip-2");
    limiter.reset();
    expect(limiter.allow("register:ip-2")).toBe(true);
  });
});
