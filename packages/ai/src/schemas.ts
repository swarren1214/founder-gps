import { z } from "zod";
import { FOUNDER_STAGES } from "@founder-gps/shared-types";

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
  availableSectors: z.array(z.string())
});

export const MapFilterSchema = z.object({
  reply: z.string().min(1),
  intent: z.enum(["filter_resources", "filter_startups", "filter_both", "clear", "general"]),
  tab: z.enum(["overview", "roadmap", "startups", "resources"]).optional(),
  resourceCategories: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  clearFilters: z.boolean().optional()
});

export type FounderAnalysisInput = z.infer<typeof FounderAnalysisInputSchema>;
export type FounderAnalysis = z.infer<typeof FounderAnalysisSchema>;
export type ExplainRecommendationInput = z.infer<typeof ExplainRecommendationInputSchema>;
export type RecommendationExplanation = z.infer<typeof RecommendationExplanationSchema>;
export type RoadmapInput = z.infer<typeof RoadmapInputSchema>;
export type Roadmap = z.infer<typeof RoadmapSchema>;
export type MapChatInput = z.infer<typeof MapChatInputSchema>;
export type MapFilter = z.infer<typeof MapFilterSchema>;
