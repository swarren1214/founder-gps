import { z } from "zod";
import { FOUNDER_STAGES } from "@founder-gps/shared-types";
import {
  FounderAnalysisSchema,
  type FounderAnalysis
} from "../types.js";

export interface IntelligenceClient {
  analyzeFounder(payload: {
    location: string;
    idea: string;
    industry?: string;
    stage: (typeof FOUNDER_STAGES)[number];
    challenge: string;
    fundingStatus?: string;
    background: string;
    founderProfileId?: string;
  }): Promise<FounderAnalysis>;
  explainRecommendation(payload: {
    founderSummary: string;
    recommendationName: string;
    recommendationReason: string;
    score: number;
  }): Promise<{ explanation: string; founderAction: string }>;
}

const analyzeResponseSchema = z.object({
  analysis: FounderAnalysisSchema
});

const explainResponseSchema = z.object({
  explanation: z.object({
    explanation: z.string(),
    founderAction: z.string()
  })
});

const analyzeRequestSchema = z.object({
  founderProfileId: z.string().uuid().optional(),
  location: z.string().min(1),
  idea: z.string().min(1),
  industry: z.string().optional(),
  stage: z.enum(FOUNDER_STAGES),
  challenge: z.string().min(1),
  fundingStatus: z.string().optional(),
  background: z.string().min(1)
});

export class HttpIntelligenceClient implements IntelligenceClient {
  constructor(private readonly baseUrl: string) {}

  async analyzeFounder(payload: {
    location: string;
    idea: string;
    industry?: string;
    stage: (typeof FOUNDER_STAGES)[number];
    challenge: string;
    fundingStatus?: string;
    background: string;
    founderProfileId?: string;
  }): Promise<FounderAnalysis> {
    const requestBody = analyzeRequestSchema.parse(payload);

    const response = await fetch(`${this.baseUrl}/intelligence/analyze-founder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...requestBody
      })
    });

    if (!response.ok) {
      throw new Error(`Intelligence analyze request failed: ${response.status}`);
    }

    const parsed = analyzeResponseSchema.parse(await response.json());
    return parsed.analysis;
  }

  async explainRecommendation(payload: {
    founderSummary: string;
    recommendationName: string;
    recommendationReason: string;
    score: number;
  }): Promise<{ explanation: string; founderAction: string }> {
    const response = await fetch(`${this.baseUrl}/intelligence/explain-recommendation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Intelligence explain request failed: ${response.status}`);
    }

    const parsed = explainResponseSchema.parse(await response.json());
    return parsed.explanation;
  }
}
