import { z } from "zod";
import { FOUNDER_STAGES, RESOURCE_CATEGORIES } from "@founder-gps/shared-types";

export const FounderProfileInputSchema = z.object({
  founderProfileId: z.string().uuid(),
  location: z.object({
    city: z.string().min(1),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional()
  }),
  idea: z.string().min(1),
  industry: z.string().min(1).optional(),
  stage: z.enum(FOUNDER_STAGES),
  challenge: z.string().min(1),
  fundingStatus: z.string().optional(),
  background: z.string().min(1)
});

export const FounderAnalysisSchema = z.object({
  stage: z.enum(FOUNDER_STAGES),
  primaryNeeds: z.array(z.string()).min(1),
  secondaryNeeds: z.array(z.string()).default([]),
  industry: z.string(),
  founderType: z.string(),
  confidenceScore: z.number().min(0).max(1),
  suggestedFocus: z.string(),
  risks: z.array(z.string())
});

export const StartupResourceSchema = z.object({
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
});

export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  founderProfileId: z.string().uuid(),
  resourceId: z.string().uuid(),
  resourceName: z.string(),
  score: z.number().min(0).max(100),
  priority: z.enum(["high", "medium", "low"]),
  reason: z.string(),
  recommendedAction: z.string(),
  scoreBreakdown: z.object({
    stageMatch: z.number().min(0).max(100),
    needMatch: z.number().min(0).max(100),
    industryMatch: z.number().min(0).max(100),
    proximity: z.number().min(0).max(100),
    urgency: z.number().min(0).max(100)
  }),
  createdAt: z.string()
});

export const GenerateRecommendationsRequestSchema = z.object({
  founderProfile: FounderProfileInputSchema,
  founderAnalysis: FounderAnalysisSchema.optional(),
  filters: z
    .object({
      category: z.enum(RESOURCE_CATEGORIES).optional(),
      city: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50)
    })
    .default({ limit: 50 }),
  topN: z.number().int().min(1).max(20).default(10),
  recompute: z.boolean().default(false)
});

export const RankRecommendationsRequestSchema = z.object({
  founderProfile: FounderProfileInputSchema,
  founderAnalysis: FounderAnalysisSchema,
  resources: z.array(StartupResourceSchema).min(1),
  topN: z.number().int().min(1).max(20).default(10)
});

export type FounderProfileInput = z.infer<typeof FounderProfileInputSchema>;
export type FounderAnalysis = z.infer<typeof FounderAnalysisSchema>;
export type StartupResource = z.infer<typeof StartupResourceSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type GenerateRecommendationsRequest = z.infer<typeof GenerateRecommendationsRequestSchema>;
export type RankRecommendationsRequest = z.infer<typeof RankRecommendationsRequestSchema>;
