import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_REDIRECTS } from "../lib/auth-routing.js";
import HomePage from "../app/page.js";
import DashboardPage from "../app/dashboard/page.js";

const redirectMock = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

const getAuthenticatedUserFromCookiesMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target)
}));

vi.mock("@/lib/auth-server", () => ({
  getAuthenticatedUserFromCookies: () => getAuthenticatedUserFromCookiesMock()
}));

describe("app route redirects", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getAuthenticatedUserFromCookiesMock.mockReset();
  });

  it("redirects / to /login when signed out", async () => {
    getAuthenticatedUserFromCookiesMock.mockResolvedValue(null);

    await expect(HomePage()).rejects.toThrow(`redirect:${AUTH_REDIRECTS.login}`);
    expect(redirectMock).toHaveBeenCalledWith(AUTH_REDIRECTS.login);
  });

  it("redirects / to authed home when signed in", async () => {
    getAuthenticatedUserFromCookiesMock.mockResolvedValue({ user: { id: "user-1" } });

    await expect(HomePage()).rejects.toThrow(`redirect:${AUTH_REDIRECTS.authedHome}`);
    expect(redirectMock).toHaveBeenCalledWith(AUTH_REDIRECTS.authedHome);
  });

  it("redirects /dashboard to /login when signed out", async () => {
    getAuthenticatedUserFromCookiesMock.mockResolvedValue(null);

    await expect(DashboardPage()).rejects.toThrow(`redirect:${AUTH_REDIRECTS.login}`);
    expect(redirectMock).toHaveBeenCalledWith(AUTH_REDIRECTS.login);
  });

  it("redirects /dashboard to authed home when signed in", async () => {
    getAuthenticatedUserFromCookiesMock.mockResolvedValue({ user: { id: "user-1" } });

    await expect(DashboardPage()).rejects.toThrow(`redirect:${AUTH_REDIRECTS.authedHome}`);
    expect(redirectMock).toHaveBeenCalledWith(AUTH_REDIRECTS.authedHome);
  });
});