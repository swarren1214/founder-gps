import { describe, expect, it } from "vitest";
import { founderIntakeSchema } from "../lib/schemas.js";
import { buildFounderIntakeFromAuthUser } from "../hooks/use-onboarding-gate.js";

describe("buildFounderIntakeFromAuthUser", () => {
  it("derives a valid founder intake from completed onboarding context", () => {
    const intake = buildFounderIntakeFromAuthUser({
      user: {
        id: "user-1",
        email: "founder@example.com",
        emailVerifiedAt: null,
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z"
      },
      profile: {
        id: "profile-1",
        userId: "user-1",
        firstName: "Alex",
        lastName: "Founder",
        companyName: "Northstar Health",
        roleTitle: "CEO",
        bio: "Building an AI care coordination platform.",
        locationCity: "Salt Lake City",
        onboardingContext: {
          schemaVersion: 1,
          identity: { firstName: "Alex", lastName: "Founder", phone: "8015551212" },
          security: { accountCreated: true },
          company: {
            companyName: "Northstar Health",
            companySize: "11-25",
            dateFounded: "2024-01-01",
            website: "https://northstar.example",
            address: "Salt Lake City, UT"
          },
          details: {
            stage: "seed",
            description: "Building an AI care coordination platform."
          },
          interview: [
            { question: "What problem are you obsessed with solving?", answer: "Reduce admin work." },
            { question: "Who is your ideal customer?", answer: "Small clinics." },
            { question: "What is your unfair advantage?", answer: "Domain expertise." },
            { question: "Where do you want to be in 18 months?", answer: "Growing revenue." },
            { question: "What is the #1 thing you need to unlock growth next?", answer: "Better distribution." }
          ]
        },
        avatarUrl: null,
        avatarStorageKey: null,
        onboardingStatus: "completed",
        onboardingCompletedAt: "2026-05-11T00:00:00.000Z",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z"
      }
    });

    const parsed = founderIntakeSchema.safeParse(intake);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.locationCity).toBe("UT");
    expect(parsed.data.industry).toBe("ai");
    expect(parsed.data.stage).toBe("mvp");
    expect(parsed.data.challenge).toBe("Better distribution.");
  });
});