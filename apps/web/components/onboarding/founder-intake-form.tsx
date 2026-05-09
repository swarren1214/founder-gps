"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  founderIntakeSchema,
  onboardingInterviewResponseSchema,
  type FounderIntake,
  type OnboardingInterviewResponse
} from "@/lib/schemas";
import { trackEvent } from "@/lib/analytics";
import { saveDashboardRun } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const stageOptions = ["pre-revenue", "seed", "series-a", "series-b-plus", "bootstrapped", "growth"] as const;

const interviewQuestions = [
  "What problem are you obsessed with solving?",
  "Who is your ideal customer and why would they pay?",
  "What is your unfair advantage right now?",
  "Where do you want the company to be in 18 months?",
  "What is the #1 thing you need to unlock growth next?"
];

type InterviewTurn = {
  question: string;
  answer: string;
};

function deriveFounderStage(stage: OnboardingState["stage"]): FounderIntake["stage"] {
  if (!stage) {
    return "validation";
  }

  switch (stage) {
    case "pre-revenue":
      return "validation";
    case "seed":
      return "mvp";
    case "series-a":
      return "launched";
    case "series-b-plus":
      return "scale";
    case "bootstrapped":
      return "traction";
    case "growth":
      return "scale";
    default:
      return "validation";
  }
}

type OnboardingState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  companySize: string;
  dateFounded: string;
  website: string;
  address: string;
  stage: (typeof stageOptions)[number] | "";
  description: string;
};

const defaultState: OnboardingState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  companyName: "",
  companySize: "",
  dateFounded: "",
  website: "",
  address: "",
  stage: "",
  description: ""
};

const steps = [
  { title: "Identity", helper: "Your personal basics" },
  { title: "Security", helper: "Set access credentials" },
  { title: "Avatar", helper: "Upload profile image" },
  { title: "Company Info", helper: "Core business information" },
  { title: "Details", helper: "Stage and company description" },
  { title: "Founder Interview", helper: "Answer AI prompts" }
] as const;

export function FounderIntakeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<OnboardingState>(defaultState);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [interview, setInterview] = useState<InterviewTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [interviewPrompt, setInterviewPrompt] = useState(interviewQuestions[0]);
  const [assistantMessage, setAssistantMessage] = useState(
    "I am ARIA, your onboarding assistant. I will ask five quick questions to personalize your dashboard."
  );
  const [isInterviewSubmitting, setIsInterviewSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  function updateField<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function nextStep() {
    if (stepIndex === 1 && form.password !== form.confirmPassword) {
      setError("Passwords must match before continuing.");
      return;
    }

    if (stepIndex === 5 && interview.length < interviewQuestions.length) {
      setError("Please answer all interview questions before completing onboarding.");
      return;
    }

    setError(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function addInterviewAnswer() {
    const answer = chatInput.trim();
    if (!answer) {
      return;
    }

    if (interview.length >= interviewQuestions.length) {
      return;
    }

    const nextTurns = [...interview, { question: interviewPrompt, answer }];
    setInterview(nextTurns);
    setChatInput("");
    setIsInterviewSubmitting(true);

    try {
      const response = await fetch("/api/onboarding/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: interview,
          currentAnswer: answer,
          context: {
            stage: form.stage,
            companyName: form.companyName
          }
        })
      });

      const payload = (await response.json()) as OnboardingInterviewResponse;
      const validated = onboardingInterviewResponseSchema.parse(payload);
      setAssistantMessage(validated.assistantMessage);
      if (validated.nextQuestion) {
        setInterviewPrompt(validated.nextQuestion);
      }
    } catch {
      const fallbackQuestion = interviewQuestions[nextTurns.length] ?? null;
      setAssistantMessage(
        fallbackQuestion
          ? `Thanks, that helps. Next: ${fallbackQuestion}`
          : "Great answers. Your founder interview is complete."
      );
      if (fallbackQuestion) {
        setInterviewPrompt(fallbackQuestion);
      }
    } finally {
      setIsInterviewSubmitting(false);
    }

    setError(null);
  }

  function buildFounderIntakePayload(): FounderIntake {
      const challenge = interview[4]?.answer || interview[0]?.answer || "Needs clearer growth constraint";
      const background = interview[2]?.answer || "Founder provided onboarding context";
    const cityGuess = form.address.split(",")[1]?.trim() || "Lehi";
      const idea = form.description.trim() || interview[0]?.answer || "Founder-provided company thesis";
      const industryGuess = form.description.toLowerCase().includes("ai")
        ? "ai"
        : form.description.toLowerCase().includes("health")
          ? "health"
          : "general";

    return {
      founderProfileId: crypto.randomUUID(),
      locationCity: cityGuess,
      locationLat: 40.3916,
      locationLng: -111.8508,
        idea,
        industry: industryGuess,
        stage: deriveFounderStage(form.stage),
      challenge,
      fundingStatus: form.stage || "bootstrapped",
      background,
      category: undefined,
      cityFilter: undefined,
      topN: 4
    };
  }

  async function submit() {
    const parsed = founderIntakeSchema.safeParse(buildFounderIntakePayload());
    if (!parsed.success) {
      setError("Please complete all founder intake fields before continuing.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        trackEvent("founder_flow_started", {
          stage: form.stage || "unknown",
          city: form.address,
          interviewAnswers: interview.length
        });

        if (avatarFile) {
          const avatarPayload = new FormData();
          avatarPayload.append("avatar", avatarFile);
          const avatarResponse = await fetch("/api/auth/avatar", {
            method: "POST",
            body: avatarPayload
          });

          const avatarJson = await avatarResponse.json();
          if (!avatarResponse.ok) {
            throw new Error(avatarJson?.error?.message ?? avatarJson?.error ?? "Avatar upload failed.");
          }
        }

        const response = await fetch("/api/founder-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data)
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.formErrors?.join(" ") ?? payload.error ?? "Founder flow failed.");
        }

        saveDashboardRun(payload);
        const onboardingContext = {
          schemaVersion: 1,
          identity: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone
          },
          security: {
            passwordConfigured: Boolean(form.password),
            passwordConfirmed: Boolean(form.password && form.password === form.confirmPassword)
          },
          company: {
            companyName: form.companyName,
            companySize: form.companySize,
            dateFounded: form.dateFounded,
            website: form.website,
            address: form.address
          },
          details: {
            stage: form.stage,
            description: form.description
          },
          interview: interview.map((turn) => ({
            question: turn.question,
            answer: turn.answer,
            answeredAt: new Date().toISOString()
          }))
        };

        await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName || null,
            lastName: form.lastName || null,
            companyName: form.companyName || null,
            locationCity: form.address || null,
            onboardingContext,
            onboardingStatus: "completed"
          })
        });

        trackEvent("founder_flow_completed", {
          recommendations: payload.recommendations.length,
          hasRoute: Boolean(payload.route),
          hasRoadmap: Boolean(payload.roadmap)
        });

        router.push("/authed/dashboard");
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Unable to complete founder flow.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <Card className="bg-[#11203b] text-white">
        <Badge className="mb-5 border-white/20 bg-white/10 text-white">Onboarding</Badge>
        <CardTitle className="text-white">Launch your founder profile</CardTitle>
        <CardDescription className="mt-3 text-white/72">
          Complete six steps to unlock your personalized dashboard and recommendations.
        </CardDescription>
        <div className="mt-8 space-y-4">
          {steps.map((item, index) => (
            <div key={item.title} className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${index <= stepIndex ? "border-white bg-white text-ink" : "border-white/20 bg-transparent text-white/60"}`}>
                {index + 1}
              </div>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-white/62">{item.helper}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-3xl bg-white/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/55">Progress</p>
          <p className="mt-3 text-sm text-white/80">
            {stepIndex + 1} / {steps.length} complete
          </p>
          <p className="mt-2 text-xs text-white/60">{Math.round(progress)}% finished</p>
        </div>
      </Card>

      <Card className="bg-card/90">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <Badge>{step.title}</Badge>
            <CardTitle className="mt-4">Founder onboarding stepper</CardTitle>
            <CardDescription className="mt-2">
              We will save this context to your profile and personalize your founder workspace.
            </CardDescription>
          </div>
          <div className="min-w-[120px] text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
            <p className="font-display text-3xl">{Math.round(progress)}%</p>
          </div>
        </div>

        <div className="mb-8 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f6a74,#ff7a1a)]" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid gap-5 text-foreground md:grid-cols-2">
          {stepIndex === 0 ? (
            <>
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
              </div>
            </>
          ) : null}

          {stepIndex === 1 ? (
            <>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} />
              </div>
            </>
          ) : null}

          {stepIndex === 2 ? (
            <>
              <div className="md:col-span-2">
                <Label htmlFor="avatarUpload">Profile avatar</Label>
                <Input
                  id="avatarUpload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setAvatarFile(nextFile);
                    if (!nextFile) {
                      setAvatarPreviewUrl(null);
                      return;
                    }

                    const nextUrl = URL.createObjectURL(nextFile);
                    setAvatarPreviewUrl(nextUrl);
                  }}
                />
                {avatarPreviewUrl ? (
                  <img
                    src={avatarPreviewUrl}
                    alt="Avatar preview"
                    className="mt-3 h-16 w-16 rounded-full object-cover"
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {stepIndex === 3 ? (
            <>
              <div>
                <Label htmlFor="companyName">Company name</Label>
                <Input id="companyName" value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="companySize">Number of employees</Label>
                <Input id="companySize" type="number" min={1} value={form.companySize} onChange={(event) => updateField("companySize", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="dateFounded">Date founded</Label>
                <Input id="dateFounded" type="date" value={form.dateFounded} onChange={(event) => updateField("dateFounded", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" value={form.website} onChange={(event) => updateField("website", event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={(event) => updateField("address", event.target.value)} />
              </div>
            </>
          ) : null}

          {stepIndex === 4 ? (
            <>
              <div>
                <Label htmlFor="founderStage">Stage</Label>
                <select
                  id="founderStage"
                  className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25"
                  value={form.stage}
                  onChange={(event) => updateField("stage", event.target.value as OnboardingState["stage"])}
                >
                  <option value="">Select stage</option>
                  {stageOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Company description</Label>
                <Textarea id="description" value={form.description} onChange={(event) => updateField("description", event.target.value)} />
              </div>
            </>
          ) : null}

          {stepIndex === 5 ? (
            <>
              <div className="md:col-span-2 rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-medium">Founder interview</p>
                <p className="mt-1 text-xs text-muted-foreground">{assistantMessage}</p>
              </div>
              <div className="md:col-span-2 space-y-4">
                {interview.map((turn, index) => (
                  <div key={`${turn.question}-${index}`} className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Question {index + 1}</p>
                    <p className="mt-1 text-sm font-medium">{turn.question}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{turn.answer}</p>
                  </div>
                ))}

                {interview.length < interviewQuestions.length ? (
                  <div className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-sm font-medium">{interviewPrompt}</p>
                    <Textarea
                      className="mt-3"
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      placeholder="Write your answer..."
                    />
                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="secondary" onClick={addInterviewAnswer} disabled={isInterviewSubmitting}>
                        {isInterviewSubmitting ? "Saving..." : "Save answer"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                    Interview complete.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {error ? <p className="mt-6 text-sm font-medium text-destructive">{error}</p> : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={previousStep} disabled={stepIndex === 0 || isPending}>
            Back
          </Button>
          {isLast ? (
            <Button size="lg" onClick={submit} disabled={isPending}>
              {isPending ? "Completing onboarding..." : "Complete onboarding"}
            </Button>
          ) : (
            <Button size="lg" onClick={nextStep}>
              Continue
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
