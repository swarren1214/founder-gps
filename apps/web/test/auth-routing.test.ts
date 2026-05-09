import { describe, expect, it } from "vitest";
import { AUTH_REDIRECTS, getProtectedRouteRedirectTarget, getSignedInRedirectTarget } from "../lib/auth-routing.js";

describe("auth routing helpers", () => {
  it("returns the signed-in redirect target when authenticated", () => {
    expect(getSignedInRedirectTarget(true)).toBe(AUTH_REDIRECTS.authedHome);
    expect(getSignedInRedirectTarget(false)).toBeNull();
  });

  it("returns the protected route redirect target when signed out", () => {
    expect(getProtectedRouteRedirectTarget(false)).toBe(AUTH_REDIRECTS.login);
    expect(getProtectedRouteRedirectTarget(true)).toBeNull();
  });
});
