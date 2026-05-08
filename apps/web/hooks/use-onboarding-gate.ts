"use client";

import { useEffect, useState } from "react";
import {
  founderFlowResponseSchema,
  type FounderFlowResponse
} from "@/lib/schemas";
import { loadDashboardRun } from "@/lib/session";

type OnboardingGateState = {
  isLoading: boolean;
  isOnboarded: boolean;
  run: FounderFlowResponse | null;
};

export function useOnboardingGate(): OnboardingGateState {
  const [state, setState] = useState<OnboardingGateState>({
    isLoading: true,
    isOnboarded: false,
    run: null
  });

  useEffect(() => {
    const parsed = founderFlowResponseSchema.safeParse(loadDashboardRun<FounderFlowResponse>());
    if (parsed.success) {
      setState({ isLoading: false, isOnboarded: true, run: parsed.data });
      return;
    }

    setState({ isLoading: false, isOnboarded: false, run: null });
  }, []);

  return state;
}
