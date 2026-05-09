import { describe, expect, it } from "vitest";
import { generateSessionToken, hashPassword, hashSessionToken, verifyPassword } from "../src/auth.js";

describe("auth utilities", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toContain(":");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("generates stable token hashes for sessions", () => {
    const token = generateSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashSessionToken(token)).toHaveLength(64);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });
});
