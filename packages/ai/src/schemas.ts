import { z } from "zod";
import { FOUNDER_STAGES, RESOURCE_CATEGORIES } from "@founder-gps/shared-types";

export const FounderAnalysisInputSchema = z.object({
  founderProfileId: z.string().uuid().optional(),
  location: z.string().min(1),
  idea: z.string().min(1),
  industry: z.string().min(1).optional(),
  stage: z.enum(FOUNDER_STAGES),
  challenge: z.string().min(1),
  fundingStatus: z.string().min(1).optional(),
  background: z.string().min(1)
});

export const FounderAnalysisSchema = z.object({
  stage: z.enum(FOUNDER_STAGES),
  primaryNeeds: z.array(z.string().min(1)).min(1),
  secondaryNeeds: z.array(z.string().min(1)).default([]),
  industry: z.string().min(1),
  founderType: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  suggestedFocus: z.string().min(1),
  risks: z.array(z.string().min(1)).min(1)
});

export const ExplainRecommendationInputSchema = z.object({
  founderSummary: z.string().min(1),
  recommendationName: z.string().min(1),
  recommendationReason: z.string().min(1),
  score: z.number().min(0).max(100)
});

export const RecommendationExplanationSchema = z.object({
  explanation: z.string().min(1),
  founderAction: z.string().min(1)
});

export const RoadmapInputSchema = z.object({
  founderProfileId: z.string().uuid().optional(),
  founderSummary: z.string().min(1),
  stage: z.enum(FOUNDER_STAGES),
  needs: z.array(z.string().min(1)).min(1),
  recommendations: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).default([])
});

export const RoadmapTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1)
});

export const RoadmapWeekSchema = z.object({
  weekNumber: z.number().int().min(1).max(4),
  goal: z.string().min(1),
  tasks: z.array(RoadmapTaskSchema).min(1)
});

export const RoadmapSchema = z.object({
  title: z.string().min(1),
  weeks: z.array(RoadmapWeekSchema).length(4)
});

export const MapChatInputSchema = z.object({
  query: z.string().min(1),
  founderSummary: z.string().min(1),
  availableCategories: z.array(z.string()),
  availableSectors: z.array(z.string()),
  availableStates: z.array(z.string()).optional(),
  availableEmployeeRanges: z.array(z.string()).optional()
});

export const MapFilterSchema = z.object({
  reply: z.string().min(1),
  intent: z.enum(["filter_resources", "filter_startups", "filter_both", "clear", "general"]),
  tab: z.enum(["overview", "roadmap", "startups", "resources"]).optional(),
  resourceCategories: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  resourceStages: z.array(z.string()).optional(),
  startupStageKeywords: z.array(z.string()).optional(),
  employeeMin: z.number().int().positive().optional(),
  employeeMax: z.number().int().positive().optional(),
  states: z.array(z.string()).optional(),
  clearFilters: z.boolean().optional()
});

const chatStylePrefsSchema = z.object({
  tone: z.enum(["concise", "encouraging", "strategic", "technical"]),
  emojiMode: z.enum(["off", "light", "expressive"]),
  verbosity: z.enum(["short", "standard", "deep dive"])
});

const chatFounderProfileSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  locationCity: z.string(),
  locationLat: z.number().nullable(),
  locationLng: z.number().nullable(),
  startupIdea: z.string(),
  industry: z.string().nullable(),
  stage: z.enum(FOUNDER_STAGES),
  biggestChallenge: z.string(),
  fundingStatus: z.string().nullable(),
  founderBackground: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const chatAnalysisSnapshotSchema = z.object({
  id: z.string(),
  founderProfileId: z.string().nullable(),
  analysisJson: z.unknown(),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  latencyMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  fallbackUsed: z.boolean(),
  createdAt: z.string()
});

const chatRecommendationSchema = z.object({
  id: z.string().optional(),
  resourceId: z.string().optional(),
  resourceName: z.string().optional(),
  score: z.number().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  reason: z.string().optional(),
  recommendedAction: z.string().optional(),
  category: z.enum(RESOURCE_CATEGORIES).optional()
});

const chatResourceSchema = z.object({
  id: z.string(),
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
  stageFit: z.array(z.enum(FOUNDER_STAGES)),
  industryFit: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});

const chatStartupSchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  employees: z.string().nullable(),
  sector: z.string().nullable(),
  yearFounded: z.number().nullable(),
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

export const ChatInputSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().uuid(),
  message: z.string().min(1),
  stylePrefs: chatStylePrefsSchema.optional(),
  context: z.object({
    founderProfile: chatFounderProfileSchema.nullable().optional(),
    founderAnalysisSnapshot: chatAnalysisSnapshotSchema.nullable().optional(),
    recommendations: z.array(chatRecommendationSchema).default([]),
    resources: z.array(chatResourceSchema).default([]),
    startups: z.array(chatStartupSchema).default([]),
    conversationSummary: z.string().default(""),
    warnings: z.array(z.string()).default([])
  })
});

export const ChatOutputSchema = z.object({
  responseMarkdown: z.string().min(1),
  responsePayload: z.object({
    kind: z.literal("chat"),
    intent: z.enum(["ask", "compare", "recommend", "act", "clarify"]),
    cards: z.array(z.record(z.unknown())),
    actions: z.array(z.record(z.unknown())),
    summary: z.string().min(1)
  }),
  citations: z.array(
    z.object({
      entityId: z.string(),
      entityType: z.string(),
      label: z.string(),
      url: z.string().optional()
    })
  ),
  suggestions: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  followUpQuestion: z.string().min(1).optional()
});

export type FounderAnalysisInput = z.infer<typeof FounderAnalysisInputSchema>;
export type FounderAnalysis = z.infer<typeof FounderAnalysisSchema>;
export type ExplainRecommendationInput = z.infer<typeof ExplainRecommendationInputSchema>;
export type RecommendationExplanation = z.infer<typeof RecommendationExplanationSchema>;
export type RoadmapInput = z.infer<typeof RoadmapInputSchema>;
export type Roadmap = z.infer<typeof RoadmapSchema>;
export type MapChatInput = z.infer<typeof MapChatInputSchema>;
export type MapFilter = z.infer<typeof MapFilterSchema>;
export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
