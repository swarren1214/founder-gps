"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  founderFlowResponseSchema,
  founderIntakeSchema,
  onboardingInterviewResponseSchema,
  type FounderIntake,
  type FounderFlowResponse,
  type OnboardingInterviewResponse
} from "@/lib/schemas";
import { trackEvent } from "@/lib/analytics";
import { saveDashboardRun } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { AddressAutocompleteInput } from "@/components/ui/address-autocomplete-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  ChartNoAxesCombined,
  Building2,
  CalendarDays,
  Check,
  FileText,
  Flag,
  Globe,
  ImageIcon,
  MapPin,
  MessageSquareText,
  PiggyBank,
  Phone,
  Rocket,
  Send,
  Sparkles,
  Sprout,
  TrendingUp,
  UploadCloud,
  User,
  UserPlus,
  Users,
  Wand2,
  X,
  ListStart,
  type LucideIcon
} from "lucide-react";

const stageOptions = ["pre-revenue", "seed", "series-a", "series-b-plus", "bootstrapped", "growth"] as const;
type StageOption = (typeof stageOptions)[number];

const stageOptionMeta: Record<StageOption, { label: string; icon: LucideIcon }> = {
  "pre-revenue": { label: "Pre Revenue", icon: ListStart },
  seed: { label: "Seed", icon: Sprout },
  "series-a": { label: "Series A", icon: Rocket },
  "series-b-plus": { label: "Series B Plus", icon: ChartNoAxesCombined },
  bootstrapped: { label: "Bootstrapped", icon: PiggyBank },
  growth: { label: "Growth", icon: TrendingUp }
};

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
  phone: string;
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
  phone: "",
  companyName: "",
  companySize: "",
  dateFounded: "",
  website: "",
  address: "",
  stage: "",
  description: ""
};

type OnboardingStep = {
  title: string;
  helper: string;
  icon: LucideIcon;
};

const steps: OnboardingStep[] = [
  { title: "Identity", helper: "Your personal basics", icon: User },
  { title: "Avatar", helper: "Upload profile image", icon: ImageIcon },
  { title: "Company Info", helper: "Core business information", icon: Building2 },
  { title: "Details", helper: "Stage and company description", icon: FileText },
  { title: "Founder Interview", helper: "Answer AI prompts", icon: MessageSquareText }
];

const onboardingJourneySteps: OnboardingStep[] = [
  { title: "Create account", helper: "Set your login credentials", icon: UserPlus },
  ...steps
];

const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const HALF_WIDTH_FIELD_CLASS = "min-w-64 flex-1";
const FULL_WIDTH_FIELD_CLASS = "w-full";

function RequiredAsterisk() {
  return <span className="ml-1 text-destructive">*</span>;
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatPhone(value: string): string {
  const digits = normalizePhoneDigits(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function FounderIntakeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<OnboardingState>(defaultState);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const [isAvatarDragActive, setIsAvatarDragActive] = useState(false);
  const [interview, setInterview] = useState<InterviewTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [interviewPrompt, setInterviewPrompt] = useState(interviewQuestions[0]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [isInterviewSubmitting, setIsInterviewSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionPhase, setSubmissionPhase] = useState<number>(-1);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const interviewEndRef = useRef<HTMLDivElement | null>(null);

  const SUBMISSION_PHASES = [
    { icon: FileText, message: "Summarizing your answers..." },
    { icon: Brain, message: "Analyzing your responses..." },
    { icon: Sparkles, message: "Building recommendations..." },
    { icon: Wand2, message: "Personalizing your workspace..." },
    { icon: Rocket, message: "Launching your founder dashboard..." }
  ] as const;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const progress = useMemo(() => ((stepIndex + 1) / onboardingJourneySteps.length) * 100, [stepIndex]);
  const activeAssistantBubble = assistantMessage.trim() || interviewPrompt;
  const avatarFallbackInitials = useMemo(() => {
    const initials = [form.firstName, form.lastName]
      .map((value) => value.trim().charAt(0))
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return initials || "FG";
  }, [form.firstName, form.lastName]);
  const isCurrentStepValid = useMemo(() => {
    if (stepIndex === 0) {
      return Boolean(form.firstName.trim() && form.lastName.trim() && normalizePhoneDigits(form.phone).length === 10);
    }

    if (stepIndex === 1) {
      return true;
    }

    if (stepIndex === 2) {
      return Boolean(
        form.companyName.trim() &&
          form.companySize.trim() &&
          form.dateFounded.trim() &&
          form.website.trim() &&
          form.address.trim()
      );
    }

    if (stepIndex === 3) {
      return Boolean(form.stage && form.description.trim());
    }

    if (stepIndex === 4) {
      return interview.length >= interviewQuestions.length;
    }

    return false;
  }, [
    stepIndex,
    form.firstName,
    form.lastName,
    form.phone,
    avatarFile,
    avatarPreviewUrl,
    form.companyName,
    form.companySize,
    form.dateFounded,
    form.website,
    form.address,
    form.stage,
    form.description,
    interview.length
  ]);

  function updateField<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function clearAvatarSelection() {
    setAvatarFile(null);
    setAvatarNotice(null);

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarPreviewUrl(null);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  function selectAvatarFile(nextFile: File | null) {
    if (!nextFile) {
      clearAvatarSelection();
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.has(nextFile.type)) {
      setAvatarNotice("Use PNG, JPG, WEBP, or GIF for your avatar.");
      return;
    }

    if (nextFile.size > MAX_AVATAR_BYTES) {
      setAvatarNotice("Avatar must be 2MB or smaller.");
      return;
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(nextFile);
    setAvatarPreviewUrl(URL.createObjectURL(nextFile));
    setAvatarNotice(null);
  }

  function handleAvatarDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsAvatarDragActive(false);
    selectAvatarFile(event.dataTransfer.files?.[0] ?? null);
  }

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (stepIndex !== 4 || interview.length > 0 || assistantMessage.trim()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/onboarding/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            turns: [],
            context: {
              stage: form.stage,
              companyName: form.companyName
            }
          })
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as OnboardingInterviewResponse;
        const validated = onboardingInterviewResponseSchema.parse(payload);
        if (cancelled) {
          return;
        }

        setAssistantMessage(validated.assistantMessage);
        if (validated.nextQuestion) {
          setInterviewPrompt(validated.nextQuestion);
        }
      } catch {
        if (!cancelled) {
          setAssistantMessage(interviewQuestions[0]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assistantMessage, form.companyName, form.stage, interview.length, stepIndex]);

  useEffect(() => {
    if (stepIndex !== 4) {
      return;
    }

    interviewEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [assistantMessage, interview.length, isInterviewSubmitting, stepIndex]);

  function nextStep() {
    if (stepIndex === steps.length - 1 && interview.length < interviewQuestions.length) {
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
    setAssistantMessage("");

    try {
      const response = await fetch("/api/onboarding/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: nextTurns,
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
      setAssistantMessage(fallbackQuestion ?? "Thanks. I have enough to complete your founder interview.");
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

    setSubmissionPhase(0);

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

        setSubmissionPhase(1);

        let dashboardRun: FounderFlowResponse;
        try {
          const response = await fetch("/api/founder-flow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data)
          });

          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error?.formErrors?.join(" ") ?? payload.error ?? "Founder flow failed.");
          }

          dashboardRun = founderFlowResponseSchema.parse(payload);
        } catch (founderFlowError) {
          const warningMessage = founderFlowError instanceof Error
            ? founderFlowError.message
            : "Founder flow failed.";

          dashboardRun = founderFlowResponseSchema.parse({
            founderProfile: parsed.data,
            analysis: {
              stage: parsed.data.stage,
              primaryNeeds: ["Complete founder onboarding"],
              secondaryNeeds: [],
              industry: parsed.data.industry,
              founderType: "general",
              confidenceScore: 0,
              suggestedFocus: "Review and refine your founder profile details.",
              risks: [warningMessage]
            },
            recommendations: [],
            route: null,
            roadmap: null,
            resources: [],
            startups: [],
            warnings: [
              `⚠️ We could not generate recommendations yet: ${warningMessage}`,
              "You can regenerate your founder plan from the dashboard."
            ]
          });
        }

        saveDashboardRun(dashboardRun);

        setSubmissionPhase(2);

        const onboardingContext = {
          schemaVersion: 1,
          identity: {
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone
          },
          security: {
            accountCreated: true
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

        const employeeCount = form.companySize ? parseInt(form.companySize, 10) : null;
        const yearFounded = form.dateFounded ? new Date(form.dateFounded).getFullYear() : null;

        const profileResponse = await fetch("/api/auth/profile", {
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

        const profilePayload = await profileResponse.json().catch(() => ({}));
        if (!profileResponse.ok) {
          throw new Error(
            profilePayload?.error?.message ??
            profilePayload?.error ??
            "Unable to save onboarding profile."
          );
        }

        const startupResponse = await fetch("/api/startups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.companyName,
            website: form.website || null,
            employees: Number.isFinite(employeeCount) ? employeeCount : null,
            yearFounded: Number.isFinite(yearFounded) ? yearFounded : null,
            description: form.description || null,
            address: form.address || null,
            stage: form.stage || null,
            dateFounded: form.dateFounded || null,
            phone: form.phone || null,
            onboardingContext
          })
        });

        if (!startupResponse.ok) {
          const startupPayload = await startupResponse.json().catch(() => ({}));
          console.warn(
            "Startup profile creation failed:",
            startupPayload?.error?.message ?? startupPayload?.error ?? "Failed to create startup profile."
          );
        }

        setSubmissionPhase(3);

        trackEvent("founder_flow_completed", {
          recommendations: dashboardRun.recommendations.length,
          hasRoute: Boolean(dashboardRun.route),
          hasRoadmap: Boolean(dashboardRun.roadmap)
        });

        setSubmissionPhase(4);

        router.push("/authed/dashboard");
      } catch (submissionError) {
        setSubmissionPhase(-1);
        setError(submissionError instanceof Error ? submissionError.message : "Unable to complete founder flow.");
      }
    });
  }

  return (
    <Card className="relative flex h-170 flex-col overflow-hidden border-border/60 bg-card/95 shadow-2xl p-0">
      {submissionPhase >= 0 ? (() => {
        const phase = SUBMISSION_PHASES[Math.min(submissionPhase, SUBMISSION_PHASES.length - 1)];
        const PhaseIcon = phase.icon;
        return (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 rounded-2xl bg-background/90 backdrop-blur-sm">
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-24 w-24 animate-ping rounded-full bg-primary/20" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <Spinner className="absolute h-14 w-14 text-primary/40" />
                <PhaseIcon className="h-7 w-7 text-primary" />
              </span>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{phase.message}</p>
              <p className="mt-1 text-sm text-muted-foreground">Step {submissionPhase + 1} of {SUBMISSION_PHASES.length}</p>
            </div>
            <div className="flex gap-1.5">
              {SUBMISSION_PHASES.map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    index <= submissionPhase ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          </div>
        );
      })() : null}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 p-5 md:p-6">
          <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="flex h-full flex-col rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Badge>Onboarding</Badge>
          </div>
          <div className="flex flex-col gap-3 flex-1">
            {onboardingJourneySteps.map((item, index) => {
              const isActive = index === stepIndex + 1;
              const isCompleted = index < stepIndex + 1;
              const StepIcon = item.icon;

              return (
                <div
                  key={item.title}
                  className={`rounded-xl border p-4 justify-center h-full flex flex-col ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : isCompleted
                        ? "border-emerald-500/35 bg-emerald-500/10"
                        : "border-border/70 bg-background/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        isCompleted
                          ? "border-emerald-500/50 bg-emerald-500 text-emerald-50"
                          : "border-border/70 bg-background/80 text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.helper}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/70">
          <div className="flex h-full min-h-0 flex-1 flex-col p-5 md:p-6">
          <div className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <Badge>{step.title}</Badge>
              <CardTitle className="mt-4">Complete your founder onboarding</CardTitle>
              <CardDescription className="mt-2">
                We will save this context to your profile and personalize your founder workspace.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 flex-wrap content-start items-stretch gap-5 text-foreground">
            {stepIndex === 0 ? (
              <>
                <div className={HALF_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="firstName" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    First name
                    <RequiredAsterisk />
                  </Label>
                  <Input id="firstName" required value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
                </div>
                <div className={HALF_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="lastName" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Last name
                    <RequiredAsterisk />
                  </Label>
                  <Input id="lastName" required value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
                </div>
                <div className={FULL_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Phone number
                    <RequiredAsterisk />
                  </Label>
                  <Input
                    id="phone"
                    required
                    inputMode="tel"
                    placeholder="(555) 123-4567"
                    maxLength={14}
                    value={form.phone}
                    onChange={(event) => updateField("phone", formatPhone(event.target.value))}
                  />
                </div>
              </>
            ) : null}

            {stepIndex === 1 ? (
              <>
                <div className={FULL_WIDTH_FIELD_CLASS}>
                  <div className="mt-3">
                    <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
                      <div className="flex flex-col items-center justify-center text-center md:w-56 md:shrink-0">
                        <Avatar className="size-28 border border-border/70">
                          <AvatarImage src={avatarPreviewUrl ?? undefined} alt="Avatar preview" />
                          <AvatarFallback>{avatarFallbackInitials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">Optional profile photo</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, GIF up to 2MB</p>
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div
                          className={cn(
                            "cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors",
                            isAvatarDragActive
                              ? "border-primary bg-primary/10"
                              : "border-border/70 bg-background/60 hover:border-primary/50"
                          )}
                          role="button"
                          tabIndex={0}
                          onClick={() => avatarInputRef.current?.click()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              avatarInputRef.current?.click();
                            }
                          }}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            setIsAvatarDragActive(true);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setIsAvatarDragActive(true);
                          }}
                          onDragLeave={() => setIsAvatarDragActive(false)}
                          onDrop={handleAvatarDrop}
                        >
                          <UploadCloud className="mx-auto h-6 w-6 text-muted-foreground" />
                          <p className="mt-2 text-sm font-medium">Drag and drop an avatar</p>
                          <p className="mt-1 text-xs text-muted-foreground">or click to browse files</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-3 rounded-md"
                            onClick={(event) => {
                              event.stopPropagation();
                              avatarInputRef.current?.click();
                            }}
                          >
                            Browse files
                          </Button>
                        </div>

                        <Input
                          ref={avatarInputRef}
                          id="avatarUpload"
                          type="file"
                          className="hidden"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(event) => selectAvatarFile(event.target.files?.[0] ?? null)}
                        />

                        {avatarFile ? (
                          <div className="mt-3 flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                            <span className="truncate pr-3">{avatarFile.name} ({Math.ceil(avatarFile.size / 1024)} KB)</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              aria-label="Clear selected file"
                              onClick={clearAvatarSelection}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null}

                        {avatarNotice ? <p className="mt-3 text-xs font-medium text-destructive">{avatarNotice}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {stepIndex === 2 ? (
              <>
                <div className={HALF_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="companyName" className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Company name
                    <RequiredAsterisk />
                  </Label>
                  <Input id="companyName" required value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} />
                </div>
                <div className={HALF_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="companySize" className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Number of employees
                    <RequiredAsterisk />
                  </Label>
                  <Input id="companySize" required type="number" min={1} value={form.companySize} onChange={(event) => updateField("companySize", event.target.value)} />
                </div>
                <div className={HALF_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="dateFounded" className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    Date founded
                    <RequiredAsterisk />
                  </Label>
                  <Input id="dateFounded" required type="date" value={form.dateFounded} onChange={(event) => updateField("dateFounded", event.target.value)} />
                </div>
                <div className={HALF_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="website" className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    Website
                    <RequiredAsterisk />
                  </Label>
                  <Input id="website" required type="url" value={form.website} onChange={(event) => updateField("website", event.target.value)} />
                </div>
                <div className={FULL_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="address" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Address
                    <RequiredAsterisk />
                  </Label>
                  <AddressAutocompleteInput
                    id="address"
                    required
                    value={form.address}
                    onChange={(nextAddress) => updateField("address", nextAddress)}
                  />
                </div>
              </>
            ) : null}

            {stepIndex === 3 ? (
              <>
                <div className="flex w-fit">
                  <fieldset>
                    <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                      <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                      Stage
                      <RequiredAsterisk />
                    </legend>
                    <div className="flex flex-row flex-wrap gap-2">
                      <div className="w-fit space-y-2">
                        {stageOptions.map((option) => {
                          const optionId = `founderStage-${option}`;
                          const isSelected = form.stage === option;
                          const optionMeta = stageOptionMeta[option];
                          const StageIcon = optionMeta.icon;

                          return (
                            <label
                              key={option}
                              htmlFor={optionId}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border/70 bg-card text-muted-foreground hover:bg-muted/40"
                              )}
                            >
                              <input
                                id={optionId}
                                type="radio"
                                name="founderStage"
                                className="sr-only"
                                checked={isSelected}
                                onChange={() => updateField("stage", option)}
                              />
                              <StageIcon className="h-4 w-4" />
                              <span>{optionMeta.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </fieldset>
                </div>
                <div className={HALF_WIDTH_FIELD_CLASS}>
                  <Label htmlFor="description" className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Company description
                    <RequiredAsterisk />
                  </Label>
                  <Textarea
                    id="description"
                    className="h-[calc(100%-1.75rem)] resize-none"
                    required
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                  />
                </div>
              </>
            ) : null}

            {stepIndex === 4 ? (
              <div className="flex h-72.5 min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-xl">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Founder Interview</h3>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 space-y-4">
                  {interview.map((turn, index) => (
                    <div key={`${turn.question}-${index}`} className="space-y-3">
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border/70 bg-muted/50 px-4 py-3 text-sm text-foreground shadow-sm">
                          <p className="font-medium">{turn.question}</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-3 text-sm text-secondary-foreground shadow-sm">
                          {turn.answer}
                        </div>
                      </div>
                    </div>
                  ))}

                  {interview.length < interviewQuestions.length ? (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border/70 bg-muted/50 px-4 py-3 text-sm text-foreground shadow-sm">
                        <p className="font-medium">{activeAssistantBubble}</p>
                      </div>
                    </div>
                  ) : null}
                  <div ref={interviewEndRef} />
                </div>

                <div className="border-t border-border/50 p-3">
                  {interview.length >= interviewQuestions.length ? (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      Interview complete.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto pt-6">
            {error ? <p className="mb-4 text-sm font-medium text-destructive">{error}</p> : null}

            {stepIndex === 4 && interview.length < interviewQuestions.length ? (
              <form
                className="flex min-w-80 flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-background/80 p-2 shadow-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addInterviewAnswer();
                }}
              >
                <Input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type your answer..."
                  className="h-10 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  disabled={isInterviewSubmitting || !chatInput.trim()}
                  aria-label="Send answer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            ) : null}
          </div>

          </div>
        </section>
          </div>
        </div>

        <footer className="w-full border-t border-border/70 bg-background/80 px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-56 flex-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
                <p className="text-xs font-medium text-foreground">{Math.round(progress)}%</p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0f6a74,#ff7a1a)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <Button variant="default" size="icon" className="flex h-fit w-fit rounded-full p-4" onClick={previousStep} disabled={stepIndex === 0 || isPending}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              {isLast ? (
                <Button
                  variant="default"
                  size="icon"
                  className="flex h-fit w-fit rounded-full p-4"
                  onClick={submit}
                  disabled={isPending || !isCurrentStepValid}
                  aria-label={isPending ? "Completing onboarding" : "Complete onboarding"}
                >
                  {isPending ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="icon"
                  className="flex h-fit w-fit rounded-full p-4"
                  onClick={nextStep}
                  disabled={!isCurrentStepValid}
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </Card>
  );
}
