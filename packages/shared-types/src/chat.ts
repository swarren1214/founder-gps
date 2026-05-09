import type { FounderStage, StartupProfile, StartupResource } from "./index.js";

export type StyleTone = "concise" | "encouraging" | "strategic" | "technical";
export type EmojiMode = "off" | "light" | "expressive";
export type Verbosity = "short" | "standard" | "deep dive";

export interface StylePrefs {
  tone: StyleTone;
  emojiMode: EmojiMode;
  verbosity: Verbosity;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
}

export interface ChatCitation {
  entityId: string;
  entityType: string;
  label: string;
  url?: string;
}

export interface ToolInvocation {
  tool: string;
  input: unknown;
  status: "pending" | "success" | "failure";
  result?: unknown;
  durationMs?: number;
}

export interface ToolResult {
  status: "success" | "failure";
  receipt: string;
  metadata: Record<string, unknown>;
  reversible?: boolean;
}

export interface RecommendationSynthesisAction {
  title: string;
  reason: string;
  score: number;
  nextStep: string;
}

export interface RecommendationSynthesis {
  rankedActions: RecommendationSynthesisAction[];
  rationale: string;
  risks: string[];
  nextSteps: string[];
}

export interface FounderProfileContext {
  id: string;
  userId: string | null;
  locationCity: string;
  locationLat: number | null;
  locationLng: number | null;
  startupIdea: string;
  industry: string | null;
  stage: FounderStage;
  biggestChallenge: string;
  fundingStatus: string | null;
  founderBackground: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FounderAnalysisSnapshotContext {
  id: string;
  founderProfileId: string | null;
  analysisJson: unknown;
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  fallbackUsed: boolean;
  createdAt: string;
}

export interface ChatContextBundle {
  founderProfile: FounderProfileContext | null;
  founderAnalysisSnapshot: FounderAnalysisSnapshotContext | null;
  recommendations: Array<Record<string, unknown>>;
  resources: StartupResource[];
  startups: StartupProfile[];
  conversationSummary: string;
  warnings: string[];
}

export interface ChatRequest {
  sessionId: string;
  userId: string;
  message: string;
  stylePrefs?: StylePrefs;
}

export interface ChatResponse {
  responseMarkdown: string;
  responsePayload: Record<string, unknown>;
  citations: ChatCitation[];
  suggestions: string[];
  metadata: Record<string, unknown>;
}
