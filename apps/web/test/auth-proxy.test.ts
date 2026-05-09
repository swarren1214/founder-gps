import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "../lib/request-security.js";

describe("auth proxy CSRF guard", () => {
  it("allows same-origin state-changing requests", () => {
    const request = new Request("https://app.example/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://app.example"
      }
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects cross-origin state-changing requests", () => {
    const request = new Request("https://app.example/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://evil.example"
      }
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("treats safe methods as allowed", () => {
    const request = new Request("https://app.example/api/auth/me", {
      method: "GET"
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });
});
