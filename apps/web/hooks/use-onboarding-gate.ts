"use client";

import { useEffect, useState } from "react";
import {
  founderFlowResponseSchema,
  founderIntakeSchema,
  type FounderFlowResponse
} from "@/lib/schemas";
import { loadDashboardRun, saveDashboardRun } from "@/lib/session";
import { useAuthUser, type AuthUserPayload } from "@/hooks/use-auth-user";

type OnboardingGateState = {
  isLoading: boolean;
  isOnboarded: boolean;
  run: FounderFlowResponse | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deriveFounderStage(stage: string | undefined): FounderFlowResponse["founderProfile"]["stage"] {
  switch (stage) {
    case "pre-revenue":
      return "validation";
    case "seed":
      return "mvp";
    case "series-a":
      return "launched";
    case "series-b-plus":
      return "scale";
    case "bootstrapped":
      return "traction";
    case "growth":
      return "scale";
    default:
      return "validation";
  }
}

export function buildFounderIntakeFromAuthUser(authUser: AuthUserPayload) {
  const onboardingContext = authUser.profile.onboardingContext;
  const company = isRecord(onboardingContext.company) ? onboardingContext.company : {};
  const details = isRecord(onboardingContext.details) ? onboardingContext.details : {};
  const interview = Array.isArray(onboardingContext.interview) ? onboardingContext.interview : [];

  const firstQuestionAnswer = typeof interview[0]?.answer === "string" ? interview[0].answer : "";
  const challenge = typeof interview[4]?.answer === "string"
    ? interview[4].answer
    : firstQuestionAnswer || "Needs clearer growth constraint";
  const background = typeof interview[2]?.answer === "string"
    ? interview[2].answer
    : authUser.profile.bio ?? "Founder provided onboarding context";

  const rawDescription =
    typeof details.description === "string" && details.description.trim().length > 0
      ? details.description
      : authUser.profile.bio ?? "";
  const idea = rawDescription.trim() || firstQuestionAnswer || authUser.profile.companyName || "Founder-provided company thesis";

  const companyName = typeof company.companyName === "string" ? company.companyName : authUser.profile.companyName ?? "";
  const companyAddress = typeof company.address === "string" ? company.address : authUser.profile.locationCity ?? "";
  const cityGuess = companyAddress.split(",")[1]?.trim() || companyAddress || "Lehi";

  const descriptionSource = rawDescription.toLowerCase();
  const industryGuess = descriptionSource.includes("ai")
    ? "ai"
    : descriptionSource.includes("health")
      ? "health"
      : companyName.toLowerCase().includes("health")
        ? "health"
        : "general";

  const stage = typeof details.stage === "string" ? details.stage : undefined;

  return {
    founderProfileId: crypto.randomUUID(),
    locationCity: cityGuess,
    locationLat: 40.3916,
    locationLng: -111.8508,
    idea,
    industry: industryGuess,
    stage: deriveFounderStage(stage),
    challenge,
    fundingStatus: typeof details.stage === "string" && details.stage.length > 0 ? details.stage : "bootstrapped",
    background,
    category: undefined,
    cityFilter: undefined,
    topN: 4
  };
}

async function parseJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    const maybeError = payload?.error;
    if (typeof maybeError === "string") {
      throw new Error(maybeError);
    }

    if (maybeError && typeof maybeError === "object") {
      const code = "code" in maybeError ? String(maybeError.code) : "UNKNOWN_ERROR";
      const message = "message" in maybeError ? String(maybeError.message) : `Request failed with ${response.status}`;
      throw new Error(`${code}: ${message}`);
    }

    throw new Error(`Request failed with ${response.status}`);
  }

  return payload;
}

async function buildFallbackRun(authUser: AuthUserPayload): Promise<FounderFlowResponse | null> {
  const intakeResult = founderIntakeSchema.safeParse(buildFounderIntakeFromAuthUser(authUser));
  if (!intakeResult.success) {
    return null;
  }

  const founderProfile = intakeResult.data;

  let resources: unknown[] = [];
  let startups: unknown[] = [];
  const warnings: string[] = ["Could not restore your saved founder plan. Showing a fallback dashboard."];

  try {
    const query = new URLSearchParams();
    query.set("limit", "500");
    query.set("lat", String(founderProfile.locationLat));
    query.set("lng", String(founderProfile.locationLng));
    query.set("radiusMiles", "250");

    const resourcesResponse = await fetch(`/api/resources?${query.toString()}`, { cache: "no-store" });
    const resourcesPayload = await parseJson(resourcesResponse);
    resources = Array.isArray(resourcesPayload.resources) ? resourcesPayload.resources : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resource hydration failed.";
    warnings.push(`Resources unavailable: ${message}`);
  }

  try {
    const startupsResponse = await fetch("/api/startups?limit=1000", { cache: "no-store" });
    const startupsPayload = await parseJson(startupsResponse);
    startups = Array.isArray(startupsPayload.startups) ? startupsPayload.startups : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Startup hydration failed.";
    warnings.push(`Startups unavailable: ${message}`);
  }

  const parsedFallback = founderFlowResponseSchema.safeParse({
    founderProfile,
    analysis: {
      stage: founderProfile.stage,
      primaryNeeds: ["customer discovery"],
      secondaryNeeds: [],
      industry: founderProfile.industry,
      founderType: "self-directed",
      confidenceScore: 0.5,
      suggestedFocus: "Review nearby resources and refine your next milestone.",
      risks: []
    },
    recommendations: [],
    route: null,
    roadmap: null,
    resources,
    startups,
    warnings
  });

  if (!parsedFallback.success) {
    return null;
  }

  return parsedFallback.data;
}

export function useOnboardingGate(): OnboardingGateState {
  const { isLoading: isAuthLoading, authUser } = useAuthUser();
  const [state, setState] = useState<OnboardingGateState>({
    isLoading: true,
    isOnboarded: false,
    run: null
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrateGate() {
      const parsed = founderFlowResponseSchema.safeParse(loadDashboardRun<FounderFlowResponse>());
      if (parsed.success) {
        if (!cancelled) {
          setState({ isLoading: false, isOnboarded: true, run: parsed.data });
        }
        return;
      }

      if (isAuthLoading) {
        return;
      }

      if (!authUser || authUser.profile.onboardingStatus !== "completed") {
        if (!cancelled) {
          setState({ isLoading: false, isOnboarded: false, run: null });
        }
        return;
      }

      const intakePayload = buildFounderIntakeFromAuthUser(authUser);
      const intake = founderIntakeSchema.safeParse(intakePayload);

      if (!intake.success) {
        if (!cancelled) {
          setState({ isLoading: false, isOnboarded: true, run: null });
        }
        return;
      }

      try {
        const response = await fetch("/api/founder-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intake.data),
          cache: "no-store"
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to restore founder dashboard.");
        }

        const validated = founderFlowResponseSchema.parse(payload);
        saveDashboardRun(validated);

        if (!cancelled) {
          setState({ isLoading: false, isOnboarded: true, run: validated });
        }
      } catch {
        const fallbackRun = await buildFallbackRun(authUser);
        if (!cancelled) {
          if (fallbackRun) {
            saveDashboardRun(fallbackRun);
            setState({ isLoading: false, isOnboarded: true, run: fallbackRun });
            return;
          }

          setState({ isLoading: false, isOnboarded: true, run: null });
        }
      }
    }

    void hydrateGate();

    return () => {
      cancelled = true;
    };
  }, [authUser, isAuthLoading]);

  return state;
}
