import { NextRequest, NextResponse } from "next/server";
import {
  onboardingInterviewRequestSchema,
  onboardingInterviewResponseSchema,
  type OnboardingInterviewResponse
} from "@/lib/schemas";

const INTERVIEW_QUESTIONS = [
  "What problem are you obsessed with solving?",
  "Who is your ideal customer and why would they pay?",
  "What is your unfair advantage right now?",
  "Where do you want the company to be in 18 months?",
  "What is the #1 thing you need to unlock growth next?"
] as const;

const MODEL_TIMEOUT_MS = 4000;

type InterviewModelPayload = {
  assistantMessage: string;
  nextQuestion: string | null;
  completed: boolean;
};

function hasPendingCurrentAnswer(input: {
  turns: Array<{ question: string; answer: string }>;
  currentAnswer?: string;
}): boolean {
  const answer = input.currentAnswer?.trim();
  if (!answer) {
    return false;
  }

  const lastTurnAnswer = input.turns.at(-1)?.answer?.trim();
  return lastTurnAnswer !== answer;
}

function deterministicResponse(turnCount: number): OnboardingInterviewResponse {
  const completed = turnCount >= INTERVIEW_QUESTIONS.length;
  const nextQuestion = completed ? null : INTERVIEW_QUESTIONS[turnCount];
  const assistantMessage = completed ? "Thanks. I have enough to complete your founder interview." : (nextQuestion ?? "");

  return {
    assistantMessage,
    nextQuestion,
    completed,
    source: "deterministic"
  };
}

function tryParseModelPayload(raw: string | null | undefined): InterviewModelPayload | null {
  const content = raw?.trim();
  if (!content) {
    return null;
  }

  const normalized = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  try {
    const parsed = JSON.parse(normalized) as Partial<InterviewModelPayload>;
    if (typeof parsed.assistantMessage !== "string") {
      return null;
    }

    if (!(typeof parsed.nextQuestion === "string" || parsed.nextQuestion === null)) {
      return null;
    }

    if (typeof parsed.completed !== "boolean") {
      return null;
    }

    return {
      assistantMessage: parsed.assistantMessage.trim(),
      nextQuestion: typeof parsed.nextQuestion === "string" ? parsed.nextQuestion.trim() : null,
      completed: parsed.completed
    };
  } catch {
    return null;
  }
}

async function generateModelInterviewTurn(input: {
  turns: Array<{ question: string; answer: string }>;
  currentAnswer?: string;
  context?: Record<string, unknown>;
  fallbackNextQuestion: string | null;
}): Promise<InterviewModelPayload | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ONBOARDING_MODEL ?? "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are an AI founder onboarding interviewer.",
              "Your job is to interview the founder conversationally and gather satisfactory answers about these business fundamentals:",
              "1. The core problem they are solving.",
              "2. Their ideal customer and why that customer will pay.",
              "3. Their current unfair advantage or unique edge.",
              "4. Where they want the company to be in 18 months.",
              "5. The main blocker they need to unlock growth next.",
              "Ask one concise but natural follow-up question at a time.",
              "If the latest answer is vague or incomplete, ask a sharper follow-up on that topic instead of moving on.",
              "Only mark completed true when the transcript covers all five areas well enough for onboarding.",
              "Return strict JSON with keys assistantMessage, nextQuestion, completed.",
              "assistantMessage must be the exact chat bubble text the founder sees.",
              "nextQuestion must be the exact question you want answered next, or null when completed is true.",
              "Do not include markdown, code fences, or extra keys."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              transcript: input.turns,
              latestAnswer: input.currentAnswer ?? null,
              context: input.context ?? {},
              fallbackNextQuestion: input.fallbackNextQuestion,
              completedTopicsTarget: 5
            })
          }
        ]
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    return tryParseModelPayload(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = onboardingInterviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const currentTurnCount = parsed.data.turns.length + (hasPendingCurrentAnswer(parsed.data) ? 1 : 0);
    const deterministic = deterministicResponse(currentTurnCount);

    const modelTurn = await generateModelInterviewTurn({
      turns: parsed.data.turns,
      currentAnswer: parsed.data.currentAnswer,
      context: parsed.data.context,
      fallbackNextQuestion: deterministic.nextQuestion
    });

    const responsePayload: OnboardingInterviewResponse = modelTurn
      ? {
          ...deterministic,
          assistantMessage: modelTurn.assistantMessage,
          nextQuestion: modelTurn.completed ? null : modelTurn.nextQuestion,
          completed: modelTurn.completed,
          source: "model"
        }
      : deterministic;

    return NextResponse.json(onboardingInterviewResponseSchema.parse(responsePayload));
  } catch {
    const fallback = deterministicResponse(0);
    return NextResponse.json(fallback, { status: 200 });
  }
}
