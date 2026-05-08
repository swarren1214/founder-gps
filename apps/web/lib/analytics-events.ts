export const analyticsEventTaxonomy = {
  preset_selected: {
    description: "Founder selected a preset profile in onboarding",
    expectedPayloadKeys: ["preset"]
  },
  founder_flow_started: {
    description: "Founder flow API request started",
    expectedPayloadKeys: ["stage", "city", "topN"]
  },
  founder_flow_completed: {
    description: "Founder flow API request completed successfully",
    expectedPayloadKeys: ["recommendations", "hasRoute", "hasRoadmap"]
  },
  founder_flow_retry_requested: {
    description: "User requested a retry from dashboard fallback state",
    expectedPayloadKeys: ["city", "topN"]
  },
  founder_flow_retry_completed: {
    description: "Retry request completed",
    expectedPayloadKeys: ["warnings", "hasRoute", "hasRoadmap"]
  }
} as const;

export type AnalyticsEventName = keyof typeof analyticsEventTaxonomy;
