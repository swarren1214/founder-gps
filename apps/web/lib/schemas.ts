import { z } from "zod";
import { FOUNDER_STAGES, RESOURCE_CATEGORIES } from "@founder-gps/shared-types";

const startupResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.enum(RESOURCE_CATEGORIES),
  description: z.string(),
  sourceExternalId: z.string().nullable().optional(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  contactEmail: z.string().nullable().optional(),
  communities: z.array(z.string()).default([]),
  address: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  lat: z.number(),
  lng: z.number(),
  locations: z.array(
    z.object({
      id: z.string().uuid(),
      locationName: z.string(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
      lat: z.number(),
      lng: z.number(),
      isPrimary: z.boolean()
    })
  ).default([]),
  stageFit: z.array(z.enum(FOUNDER_STAGES)),
  industryFit: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});

const startupProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  employees: z.string().nullable(),
  sector: z.string().nullable(),
  yearFounded: z.number().int().nullable(),
  linkedin: z.string().nullable(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  hiringStatus: z.string().nullable(),
  jobPostings: z.array(z.unknown()),
  photoGallery: z.array(z.unknown()),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const founderIntakeSchema = z.object({
  founderProfileId: z.string().uuid(),
  locationCity: z.string().min(2),
  locationLat: z.number().min(-90).max(90),
  locationLng: z.number().min(-180).max(180),
  idea: z.string().min(8),
  industry: z.string().min(2),
  stage: z.enum(FOUNDER_STAGES),
  challenge: z.string().min(8),
  fundingStatus: z.string().min(2),
  background: z.string().min(8),
  category: z.enum(RESOURCE_CATEGORIES).optional(),
  cityFilter: z.string().optional(),
  topN: z.number().int().min(1).max(8).default(4)
});

export const founderAnalysisSchema = z.object({
  stage: z.enum(FOUNDER_STAGES),
  primaryNeeds: z.array(z.string()).min(1),
  secondaryNeeds: z.array(z.string()),
  industry: z.string(),
  founderType: z.string(),
  confidenceScore: z.number(),
  suggestedFocus: z.string(),
  risks: z.array(z.string())
});

export const recommendationSchema = z.object({
  id: z.string().uuid(),
  founderProfileId: z.string().uuid(),
  resourceId: z.string().uuid(),
  resourceName: z.string(),
  score: z.number(),
  priority: z.enum(["high", "medium", "low"]),
  reason: z.string(),
  recommendedAction: z.string(),
  scoreBreakdown: z.object({
    stageMatch: z.number(),
    needMatch: z.number(),
    industryMatch: z.number(),
    proximity: z.number(),
    urgency: z.number()
  }),
  createdAt: z.string()
});

export const founderRouteSchema = z.object({
  orderedStops: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      category: z.enum(RESOURCE_CATEGORIES),
      description: z.string(),
      website: z.string().nullable(),
      logoUrl: z.string().nullable(),
      address: z.string().nullable(),
      city: z.string(),
      state: z.string(),
      lat: z.number(),
      lng: z.number(),
      stageFit: z.array(z.string()),
      industryFit: z.array(z.string()),
      tags: z.array(z.string()),
      createdAt: z.string(),
      updatedAt: z.string()
    })
  ),
  totalDriveTimeMinutes: z.number(),
  totalDistanceMiles: z.number(),
  geojson: z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(
      z.object({
        type: z.literal("Feature"),
        geometry: z.object({
          type: z.literal("LineString"),
          coordinates: z.array(z.tuple([z.number(), z.number()]))
        }),
        properties: z.object({
          distanceMeters: z.number(),
          durationSeconds: z.number(),
          mode: z.literal("driving")
        })
      })
    )
  })
});

export const roadmapSchema = z.object({
  title: z.string(),
  weeks: z.array(
    z.object({
      weekNumber: z.number(),
      goal: z.string(),
      tasks: z.array(
        z.object({
          title: z.string(),
          description: z.string()
        })
      )
    })
  )
});

export const founderFlowResponseSchema = z.object({
  founderProfile: founderIntakeSchema,
  analysis: founderAnalysisSchema,
  recommendations: z.array(recommendationSchema),
  route: founderRouteSchema.nullable(),
  roadmap: roadmapSchema.nullable(),
  resources: z.array(startupResourceSchema),
  startups: z.array(startupProfileSchema).default([]),
  warnings: z.array(z.string())
});

export const mapFilterSchema = z.object({
  intent: z.enum(["filter_resources", "filter_startups", "filter_both", "clear", "general"]),
  tab: z.enum(["overview", "roadmap", "startups", "resources"]).optional(),
  resourceCategories: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  clearFilters: z.boolean().optional()
});

export const mapChatRequestSchema = z.object({
  query: z.string().min(1),
  founderSummary: z.string().min(1),
  availableCategories: z.array(z.string()),
  availableSectors: z.array(z.string())
});

export const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().uuid(),
  message: z.string().min(1),
  stylePrefs: z
    .object({
      tone: z.enum(["concise", "encouraging", "strategic", "technical"]),
      emojiMode: z.enum(["off", "light", "expressive"]),
      verbosity: z.enum(["short", "standard", "deep dive"])
    })
    .optional()
});

export const chatResponseSchema = z.object({
  responseMarkdown: z.string(),
  responsePayload: z.record(z.unknown()),
  citations: z.array(
    z.object({
      entityId: z.string(),
      entityType: z.string(),
      label: z.string(),
      url: z.string().optional()
    })
  ),
  suggestions: z.array(z.string()),
  metadata: z.record(z.unknown()),
  sessionId: z.string(),
  contextSummary: z.string()
});

export type FounderIntake = z.infer<typeof founderIntakeSchema>;
export type FounderAnalysis = z.infer<typeof founderAnalysisSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type FounderRoute = z.infer<typeof founderRouteSchema>;
export type Roadmap = z.infer<typeof roadmapSchema>;
export type FounderFlowResponse = z.infer<typeof founderFlowResponseSchema>;
export type ResourceCardData = z.infer<typeof startupResourceSchema>;
export type StartupProfileData = z.infer<typeof startupProfileSchema>;
export type MapFilters = z.infer<typeof mapFilterSchema>;
export type MapChatRequest = z.infer<typeof mapChatRequestSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
