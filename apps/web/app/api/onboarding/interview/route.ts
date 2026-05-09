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

function deterministicResponse(turnCount: number): OnboardingInterviewResponse {
  const completed = turnCount >= INTERVIEW_QUESTIONS.length;
  const nextQuestion = completed ? null : INTERVIEW_QUESTIONS[turnCount];
  const assistantMessage = completed
    ? "Great answers. Your founder interview is complete."
    : `Thanks, that helps. Next: ${nextQuestion}`;

  return {
    assistantMessage,
    nextQuestion,
    completed,
    source: "deterministic"
  };
}

async function generateModelAssistantMessage(input: {
  turns: Array<{ question: string; answer: string }>;
  currentAnswer?: string;
  nextQuestion: string | null;
}): Promise<string | null> {
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
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are a concise founder onboarding interviewer. Acknowledge the user's last answer in one sentence and ask exactly one next question if provided. Keep response under 2 sentences."
          },
          {
            role: "user",
            content: JSON.stringify(input)
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
    return content || null;
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

    const currentTurnCount = parsed.data.turns.length;
    const deterministic = deterministicResponse(currentTurnCount);

    // Deterministic path always produces a valid response. Model path only augments text.
    const modelMessage = await generateModelAssistantMessage({
      turns: parsed.data.turns,
      currentAnswer: parsed.data.currentAnswer,
      nextQuestion: deterministic.nextQuestion
    });

    const responsePayload: OnboardingInterviewResponse = modelMessage
      ? {
          ...deterministic,
          assistantMessage: modelMessage,
          source: "model"
        }
      : deterministic;

    return NextResponse.json(onboardingInterviewResponseSchema.parse(responsePayload));
  } catch {
    const fallback = deterministicResponse(0);
    return NextResponse.json(fallback, { status: 200 });
  }
}
