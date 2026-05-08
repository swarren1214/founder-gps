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
  type RoadmapInput
} from "./schemas.js";
import {
  analyzeFounderPrompt,
  explainRecommendationPrompt,
  generateRoadmapPrompt,
  PROMPT_VERSIONS
} from "./prompts.js";

export type AiTask = "analyze-founder" | "explain-recommendation" | "generate-roadmap";

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

  constructor(private readonly apiKey: string, public readonly model: string) {}

  async generateObject<T>(options: GenerateObjectOptions<T>): Promise<AiResult<T>> {
    const started = Date.now();
    const payloadText = JSON.stringify(options.userPayload);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
  geminiApiKey?: string;
  model?: string;
  timeoutMs?: number;
};

export class AiService {
  private readonly fallbackProvider = new HeuristicProvider();

  constructor(private readonly config: AiServiceConfig = {}) {}

  private selectProvider(): AiProvider {
    if (this.config.provider === "openai" && this.config.openAiApiKey) {
      return new OpenAiProvider(this.config.openAiApiKey, this.config.model ?? "gpt-4o-mini");
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
}
