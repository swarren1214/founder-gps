import { z } from "zod";
import {
  FounderAnalysisSchema,
  type FounderAnalysis,
  type FounderAnalysisInput,
  RecommendationExplanationSchema,
  type RecommendationExplanation,
  type ExplainRecommendationInput,
  RoadmapSchema,
  type Roadmap,
  type RoadmapInput,
  MapFilterSchema,
  type MapFilter,
  type MapChatInput,
  ChatInputSchema,
  ChatOutputSchema,
  type ChatInput,
  type ChatOutput
} from "./schemas.js";
import {
  analyzeFounderPrompt,
  chatPrompt,
  explainRecommendationPrompt,
  generateRoadmapPrompt,
  mapChatPrompt,
  PROMPT_VERSIONS
} from "./prompts.js";

export type AiTask = "analyze-founder" | "explain-recommendation" | "generate-roadmap" | "map-chat" | "chat";

export type AiMetadata = {
  provider: "openai" | "gemini" | "heuristic";
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  fallbackUsed: boolean;
};

export type AiResult<T> = {
  data: T;
  metadata: AiMetadata;
};

type GenerateObjectOptions<T> = {
  task: AiTask;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  systemPrompt: string;
  userPayload: unknown;
};

interface AiProvider {
  name: AiMetadata["provider"];
  model: string;
  generateObject<T>(options: GenerateObjectOptions<T>): Promise<AiResult<T>>;
}

class OpenAiProvider implements AiProvider {
  name: AiMetadata["provider"] = "openai";

  constructor(
    private readonly apiKey: string,
    public readonly model: string,
    private readonly baseUrl: string = "https://api.openai.com/v1"
  ) {}

  async generateObject<T>(options: GenerateObjectOptions<T>): Promise<AiResult<T>> {
    const started = Date.now();
    const payloadText = JSON.stringify(options.userPayload);

    const endpoint = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: payloadText }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }

    const parsedJson = JSON.parse(content);
    const parsed = options.schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(`OpenAI response schema validation failed: ${parsed.error.message}`);
    }

    return {
      data: parsed.data,
      metadata: {
        provider: this.name,
        model: this.model,
        promptVersion: options.promptVersion,
        latencyMs: Date.now() - started,
        tokensIn: json.usage?.prompt_tokens ?? estimateTokens(payloadText),
        tokensOut: json.usage?.completion_tokens ?? estimateTokens(content),
        fallbackUsed: false
      }
    };
  }
}

class GeminiProvider implements AiProvider {
  name: AiMetadata["provider"] = "gemini";

  constructor(private readonly apiKey: string, public readonly model: string) {}

  async generateObject<T>(options: GenerateObjectOptions<T>): Promise<AiResult<T>> {
    const started = Date.now();
    const payloadText = JSON.stringify(options.userPayload);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: options.systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: payloadText }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("Gemini returned empty content");
    }

    const parsedJson = JSON.parse(content);
    const parsed = options.schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(`Gemini response schema validation failed: ${parsed.error.message}`);
    }

    return {
      data: parsed.data,
      metadata: {
        provider: this.name,
        model: this.model,
        promptVersion: options.promptVersion,
        latencyMs: Date.now() - started,
        tokensIn: json.usageMetadata?.promptTokenCount ?? estimateTokens(payloadText),
        tokensOut: json.usageMetadata?.candidatesTokenCount ?? estimateTokens(content),
        fallbackUsed: false
      }
    };
  }
}

function estimateTokens(input: string): number {
  return Math.max(1, Math.round(input.length / 4));
}

class HeuristicProvider implements AiProvider {
  name: AiMetadata["provider"] = "heuristic";
  model = "heuristic-v1";

  async generateObject<T>(options: GenerateObjectOptions<T>): Promise<AiResult<T>> {
    const started = Date.now();

    let draft: unknown;
    if (options.task === "analyze-founder") {
      const input = options.userPayload as FounderAnalysisInput;
      const normalizedStage = input.stage === "idea" ? "validation" : input.stage;
      const industry = input.industry ?? "general";
      draft = {
        stage: normalizedStage,
        primaryNeeds: [
          "customer_discovery",
          input.stage === "idea" ? "prototype_strategy" : "distribution_strategy"
        ],
        secondaryNeeds: ["mentor_network"],
        industry,
        founderType: input.background.toLowerCase().includes("product")
          ? "product_led_operator"
          : "domain_operator",
        confidenceScore: 0.82,
        suggestedFocus:
          input.stage === "idea"
            ? "Validate customer pain and buying intent before building full product scope."
            : "Prioritize weekly customer feedback loops and revenue-driving execution.",
        risks: [
          "Building before validating urgency",
          "Targeting too broad a customer segment",
          "Underinvesting in distribution discovery"
        ]
      };
    } else if (options.task === "explain-recommendation") {
      const input = options.userPayload as ExplainRecommendationInput;
      draft = {
        explanation: `${input.recommendationName} is relevant because ${input.recommendationReason}.`,
        founderAction: `Schedule one concrete next step this week with ${input.recommendationName}.`
      };
    } else if (options.task === "map-chat") {
      const input = options.userPayload as MapChatInput;
      const queryLower = input.query.toLowerCase();
      const employeeBetweenMatch = queryLower.match(/between\s+(\d+)\s+and\s+(\d+)\s+employees?/i);
      const employeeMoreThanMatch = queryLower.match(/(?:more than|over|greater than)\s+(\d+)\s+employees?/i);
      const employeeAtLeastMatch = queryLower.match(/(?:at least|minimum of)\s+(\d+)\s+employees?/i);
      const employeeLessThanMatch = queryLower.match(/(?:less than|under|fewer than)\s+(\d+)\s+employees?/i);
      const employeeAtMostMatch = queryLower.match(/(?:at most|no more than)\s+(\d+)\s+employees?/i);
      const isFilterRequest =
        queryLower.includes("show") ||
        queryLower.includes("find") ||
        queryLower.includes("funding") ||
        queryLower.includes("mentor") ||
        queryLower.includes("resource") ||
        queryLower.includes("startup");
      const isClearRequest = queryLower.includes("clear") || queryLower.includes("all") || queryLower.includes("reset");

      if (isClearRequest) {
        draft = {
          reply: "Cleared all filters. Showing all resources and startups.",
          intent: "clear",
          clearFilters: true
        };
      } else if (isFilterRequest) {
        const isFunding =
          queryLower.includes("funding") || queryLower.includes("capital") || queryLower.includes("investment");
        const isMentor = queryLower.includes("mentor") || queryLower.includes("advisor");
        const isUtah = queryLower.includes("utah");
        const isSoftware =
          queryLower.includes("software") || queryLower.includes("saas") || queryLower.includes("tech");

        const stageKeywords: string[] = [];
        const hasPreSeed = /\bpre[-\s]?seed\b/i.test(queryLower);
        if (hasPreSeed) stageKeywords.push("pre-seed");
        if (!hasPreSeed && /\bseed\b/i.test(queryLower)) stageKeywords.push("seed");
        if (/\bseries\s*a\b/i.test(queryLower)) stageKeywords.push("series a");
        if (/\bseries\s*b\b/i.test(queryLower)) stageKeywords.push("series b");
        if (/\bseries\s*c\b/i.test(queryLower)) stageKeywords.push("series c");
        if (/\bgrowth\b/i.test(queryLower)) stageKeywords.push("growth");

        let employeeMin: number | undefined;
        let employeeMax: number | undefined;
        if (employeeBetweenMatch) {
          const first = Number(employeeBetweenMatch[1]);
          const second = Number(employeeBetweenMatch[2]);
          if (Number.isFinite(first) && Number.isFinite(second)) {
            employeeMin = Math.min(first, second);
            employeeMax = Math.max(first, second);
          }
        }
        if (employeeMoreThanMatch) {
          const value = Number(employeeMoreThanMatch[1]);
          if (Number.isFinite(value)) {
            employeeMin = value + 1;
          }
        }
        if (employeeAtLeastMatch) {
          const value = Number(employeeAtLeastMatch[1]);
          if (Number.isFinite(value)) {
            employeeMin = value;
          }
        }
        if (employeeLessThanMatch) {
          const value = Number(employeeLessThanMatch[1]);
          if (Number.isFinite(value)) {
            employeeMax = Math.max(1, value - 1);
          }
        }
        if (employeeAtMostMatch) {
          const value = Number(employeeAtMostMatch[1]);
          if (Number.isFinite(value)) {
            employeeMax = value;
          }
        }

        const matchedCategories = input.availableCategories.filter((cat) => {
          const catLower = cat.toLowerCase();
          return (isFunding && catLower.includes("fund")) ||
            (isMentor && catLower.includes("mentor")) ||
            catLower.includes("accelerator") ||
            catLower.includes("investor");
        });

        const matchedSectors = input.availableSectors.filter((sec) => {
          const secLower = sec.toLowerCase();
          return isSoftware && secLower.includes("software");
        });

        const keywords = [];
        if (isFunding) keywords.push("funding", "capital");
        if (isMentor) keywords.push("mentor", "advisor");
        if (isSoftware) keywords.push("software", "saas");

        const matchedStates = input.availableStates?.filter((state) => {
          const normalized = state.toLowerCase();
          return normalized === "ut" ? isUtah : queryLower.includes(normalized);
        }) ?? (isUtah ? ["UT"] : []);

        const hasStartupSpecificConstraints =
          matchedSectors.length > 0 ||
          stageKeywords.length > 0 ||
          employeeMin !== undefined ||
          employeeMax !== undefined;

        const intent: MapFilter["intent"] = hasStartupSpecificConstraints
          ? matchedCategories.length > 0
            ? "filter_both"
            : "filter_startups"
          : "filter_resources";

        draft = {
          reply: `Filtering for ${matchedCategories.length > 0 ? "relevant funding and mentor resources" : "related resources"}.`,
          intent,
          tab: hasStartupSpecificConstraints ? "startups" : "resources",
          resourceCategories: matchedCategories.length > 0 ? matchedCategories : undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          sectors: matchedSectors.length > 0 ? matchedSectors : undefined,
          states: matchedStates.length > 0 ? matchedStates : undefined,
          startupStageKeywords: stageKeywords.length > 0 ? stageKeywords : undefined,
          employeeMin,
          employeeMax
        };
      } else {
        draft = {
          reply: "I can help you filter resources and startups. Try asking for specific types like 'funding resources', 'mentor startups', or 'clear filters'.",
          intent: "general"
        };
      }
    } else if (options.task === "chat") {
      const input = ChatInputSchema.parse(options.userPayload) as ChatInput;
      const profile = input.context.founderProfile;
      const analysis = input.context.founderAnalysisSnapshot?.analysisJson as
        | { stage?: string; primaryNeeds?: string[]; suggestedFocus?: string; confidenceScore?: number }
        | undefined;
      const recommendations = input.context.recommendations.slice(0, 3);
      const resources = input.context.resources.slice(0, 3);
      const startups = input.context.startups.slice(0, 2);
      const hasProfile = profile !== null && profile !== undefined;
      const intent: "ask" | "compare" | "recommend" | "act" | "clarify" = /compare|vs|versus/i.test(input.message)
        ? "compare"
        : /recommend|suggest|what should i do/i.test(input.message)
          ? "recommend"
          : /do it|save|filter|open|show/i.test(input.message)
            ? "act"
            : hasProfile
              ? "ask"
              : "clarify";

      const topRecommendation = recommendations[0] as Record<string, unknown> | undefined;
      const topResource = resources[0] as Record<string, unknown> | undefined;
      const topStartup = startups[0] as Record<string, unknown> | undefined;

      const markdownLines = [
        `## ${profile ? `${profile.locationCity} founder update` : "Founder update"}`,
        profile
          ? `You are at the ${profile.stage} stage, building ${profile.startupIdea}.`
          : "I need your founder profile before I can ground the answer in your startup context.",
        analysis?.suggestedFocus ? `**Current focus:** ${analysis.suggestedFocus}` : null,
        topRecommendation
          ? `**Top recommendation:** ${String(topRecommendation.resourceName ?? topRecommendation.name ?? "resource")}`
          : null,
        topResource ? `**Relevant resource:** ${String(topResource.name ?? "resource")}` : null,
        topStartup ? `**Nearby startup to watch:** ${String(topStartup.name ?? "startup")}` : null,
        input.context.warnings.length > 0 ? `> ${input.context.warnings[0]}` : null,
        "",
        "### Next move",
        hasProfile
          ? "Pick one concrete action this week and keep the scope narrow."
          : "Share your location, stage, idea, and biggest challenge so I can tailor the answer."
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      draft = {
        responseMarkdown: markdownLines,
        responsePayload: {
          kind: "chat",
          intent,
          cards: [
            ...(profile
              ? [{ kind: "founder_profile", founderProfileId: profile.id, stage: profile.stage, city: profile.locationCity }]
              : []),
            ...(topRecommendation
              ? [{ kind: "recommendation", label: String(topRecommendation.resourceName ?? topRecommendation.name ?? "Recommendation") }]
              : []),
            ...(topResource ? [{ kind: "resource", label: String(topResource.name ?? "Resource") }] : [])
          ],
          actions: hasProfile
            ? [{ kind: "follow_up", label: "Refine your founder context" }]
            : [{ kind: "share_profile", label: "Add founder profile details" }],
          summary: profile
            ? `${profile.locationCity} founder at ${profile.stage} stage with ${recommendations.length} recommendation(s) and ${resources.length} resource(s).`
            : "Chat needs founder profile context to ground recommendations."
        },
        citations: [
          ...(profile
            ? [{ entityId: profile.id, entityType: "founder_profile", label: `${profile.locationCity} founder profile` }]
            : []),
          ...(analysis
            ? [
                {
                  entityId: input.context.founderAnalysisSnapshot?.id ?? "latest-analysis",
                  entityType: "founder_analysis_snapshot",
                  label: "Latest founder analysis"
                }
              ]
            : []),
          ...(topRecommendation
            ? [
                {
                  entityId: String(topRecommendation.id ?? topRecommendation.resourceId ?? "recommendation"),
                  entityType: "recommendation",
                  label: String(topRecommendation.resourceName ?? topRecommendation.name ?? "Top recommendation")
                }
              ]
            : []),
          ...(topResource
            ? [{ entityId: String(topResource.id ?? "resource"), entityType: "resource", label: String(topResource.name ?? "Resource") }]
            : []),
          ...(topStartup
            ? [{ entityId: String(topStartup.id ?? "startup"), entityType: "startup", label: String(topStartup.name ?? "Startup") }]
            : [])
        ],
        suggestions: hasProfile
          ? [
              "Ask me to compare two resources.",
              "Ask for a 7-day action plan.",
              "Ask me to explain why the top recommendation matters now."
            ]
          : ["Share your founder profile to ground the next answer.", "Include stage, location, idea, and challenge."],
        confidence: hasProfile ? 0.81 : 0.42,
        followUpQuestion: hasProfile ? undefined : "What is your founder stage and biggest constraint right now?"
      };
    } else {
      const input = options.userPayload as RoadmapInput;
      draft = {
        title: "30-Day Founder Action Plan",
        weeks: [
          {
            weekNumber: 1,
            goal: "Validate the highest-risk assumption",
            tasks: [
              {
                title: "Run 10 founder interviews",
                description: `Interview 10 target customers focused on ${input.needs[0]}.`
              },
              {
                title: "Capture problem language",
                description: "Document exact customer pain statements and frequency."
              }
            ]
          },
          {
            weekNumber: 2,
            goal: "Refine value proposition",
            tasks: [
              {
                title: "Draft positioning statement",
                description: "Create clear ICP + problem + differentiated value framing."
              },
              {
                title: "Test messaging",
                description: "Validate messaging in five new customer calls."
              }
            ]
          },
          {
            weekNumber: 3,
            goal: "Scope MVP execution",
            tasks: [
              {
                title: "Define MVP boundaries",
                description: "Lock first-release features to core user outcome only."
              },
              {
                title: "Plan first distribution motion",
                description: "Select one acquisition channel and define weekly targets."
              }
            ]
          },
          {
            weekNumber: 4,
            goal: "Prepare next-step growth plan",
            tasks: [
              {
                title: "Create traction narrative",
                description: "Summarize customer evidence, learning, and roadmap decisions."
              },
              {
                title: "Set 30-day milestones",
                description: "Define measurable goals for validation, product, and growth."
              }
            ]
          }
        ]
      };
    }

    const parsed = options.schema.safeParse(draft);
    if (!parsed.success) {
      throw new Error(`Heuristic provider schema validation failed: ${parsed.error.message}`);
    }

    const payloadText = JSON.stringify(options.userPayload);
    const outputText = JSON.stringify(parsed.data);

    return {
      data: parsed.data,
      metadata: {
        provider: this.name,
        model: this.model,
        promptVersion: options.promptVersion,
        latencyMs: Date.now() - started,
        tokensIn: estimateTokens(payloadText),
        tokensOut: estimateTokens(outputText),
        fallbackUsed: true
      }
    };
  }
}

export type AiServiceConfig = {
  provider?: "openai" | "gemini" | "heuristic";
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  geminiApiKey?: string;
  model?: string;
  timeoutMs?: number;
};

export class AiService {
  private readonly fallbackProvider = new HeuristicProvider();

  constructor(private readonly config: AiServiceConfig = {}) {}

  private selectProvider(): AiProvider {
    if (this.config.provider === "openai" && this.config.openAiApiKey) {
      const defaultModel = this.config.openAiBaseUrl?.includes("integrate.api.nvidia.com")
        ? "mistralai/mistral-nemotron"
        : "gpt-4o-mini";

      return new OpenAiProvider(
        this.config.openAiApiKey,
        this.config.model ?? defaultModel,
        this.config.openAiBaseUrl ?? "https://api.openai.com/v1"
      );
    }

    if (this.config.provider === "gemini" && this.config.geminiApiKey) {
      return new GeminiProvider(this.config.geminiApiKey, this.config.model ?? "gemini-1.5-flash");
    }

    // For MVP reliability, default to deterministic heuristic provider.
    return this.fallbackProvider;
  }

  private async withFallback<T>(
    provider: AiProvider,
    options: GenerateObjectOptions<T>
  ): Promise<AiResult<T>> {
    const timeoutMs = this.config.timeoutMs ?? 12000;
    try {
      const result = await Promise.race([
        provider.generateObject(options),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`AI provider timeout after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);

      return result;
    } catch (_error) {
      const fallback = await this.fallbackProvider.generateObject(options);
      return {
        ...fallback,
        metadata: {
          ...fallback.metadata,
          fallbackUsed: true
        }
      };
    }
  }

  async analyzeFounder(input: FounderAnalysisInput): Promise<AiResult<FounderAnalysis>> {
    const provider = this.selectProvider();

    const result = await this.withFallback(provider, {
      task: "analyze-founder",
      schema: FounderAnalysisSchema,
      promptVersion: PROMPT_VERSIONS.analyzeFounder,
      systemPrompt: analyzeFounderPrompt(),
      userPayload: input
    });

    const normalized = {
      ...result.data,
      stage: result.data.stage,
      confidenceScore: Math.min(1, Math.max(0, result.data.confidenceScore)),
      primaryNeeds: [...new Set(result.data.primaryNeeds)],
      secondaryNeeds: [...new Set(result.data.secondaryNeeds)]
    } satisfies FounderAnalysis;

    return {
      data: FounderAnalysisSchema.parse(normalized),
      metadata: result.metadata
    };
  }

  async explainRecommendation(
    input: ExplainRecommendationInput
  ): Promise<AiResult<RecommendationExplanation>> {
    const provider = this.selectProvider();
    return this.withFallback(provider, {
      task: "explain-recommendation",
      schema: RecommendationExplanationSchema,
      promptVersion: PROMPT_VERSIONS.explainRecommendation,
      systemPrompt: explainRecommendationPrompt(),
      userPayload: input
    });
  }

  async generateRoadmap(input: RoadmapInput): Promise<AiResult<Roadmap>> {
    const provider = this.selectProvider();
    return this.withFallback(provider, {
      task: "generate-roadmap",
      schema: RoadmapSchema,
      promptVersion: PROMPT_VERSIONS.generateRoadmap,
      systemPrompt: generateRoadmapPrompt(),
      userPayload: input
    });
  }

  async chatWithMap(input: MapChatInput): Promise<AiResult<MapFilter>> {
    const provider = this.selectProvider();
    return this.withFallback(provider, {
      task: "map-chat",
      schema: MapFilterSchema,
      promptVersion: PROMPT_VERSIONS.mapChat,
      systemPrompt: mapChatPrompt(),
      userPayload: input
    });
  }

  async chat(input: ChatInput): Promise<AiResult<ChatOutput>> {
    const provider = this.selectProvider();
    return this.withFallback(provider, {
      task: "chat",
      schema: ChatOutputSchema,
      promptVersion: PROMPT_VERSIONS.chat,
      systemPrompt: chatPrompt(input.stylePrefs),
      userPayload: input
    });
  }

  async *streamChat(input: ChatInput): AsyncIterable<string> {
    const result = await this.chat(input);
    yield JSON.stringify(result.data);
  }
}
