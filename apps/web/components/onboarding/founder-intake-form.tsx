"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { founderPresets } from "@/lib/presets";
import { founderIntakeSchema, type FounderIntake } from "@/lib/schemas";
import { trackEvent } from "@/lib/analytics";
import { saveDashboardRun } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const stageOptions = ["idea", "validation", "mvp", "launched", "traction", "fundraising", "scale"] as const;
const categoryOptions = ["community", "investor", "university", "coworking", "accelerator", "incubator"] as const;

const defaultValue: FounderIntake = {
  founderProfileId: crypto.randomUUID(),
  locationCity: "Lehi",
  locationLat: 40.3916,
  locationLng: -111.8508,
  idea: "",
  industry: "",
  stage: "validation",
  challenge: "",
  fundingStatus: "bootstrapped",
  background: "",
  category: undefined,
  cityFilter: undefined,
  topN: 4
};

const steps = [
  { title: "Founder profile", fields: ["locationCity", "idea", "industry", "stage"] },
  { title: "Momentum and blockers", fields: ["challenge", "fundingStatus", "background"] },
  { title: "Demo tuning", fields: ["category", "cityFilter", "topN"] }
] as const;

export function FounderIntakeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FounderIntake>(defaultValue);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  function updateField<K extends keyof FounderIntake>(key: K, value: FounderIntake[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(index: number) {
    const preset = founderPresets[index];
    setForm({
      ...preset.value,
      founderProfileId: crypto.randomUUID()
    });
    setSelectedPresetLabel(preset.label);
    setStepIndex(0);
    setError(null);
    queueMicrotask(() => {
      const target = document.getElementById("locationCity") as HTMLInputElement | null;
      target?.focus();
    });
    trackEvent("preset_selected", { preset: preset.label });
  }

  function nextStep() {
    setError(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function submit() {
    const parsed = founderIntakeSchema.safeParse(form);
    if (!parsed.success) {
      setError("Please complete all founder intake fields before continuing.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        trackEvent("founder_flow_started", {
          stage: form.stage,
          city: form.locationCity,
          topN: form.topN
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
        await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationCity: form.locationCity,
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
    <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
      <Card className="bg-[#11203b] text-white">
        <Badge className="mb-5 border-white/20 bg-white/10 text-white">Founder intake</Badge>
        <CardTitle className="text-white">Build your dashboard run</CardTitle>
        <CardDescription className="mt-3 text-white/72">
          Complete three short steps to generate a focused founder plan with recommendations, route, and roadmap.
        </CardDescription>
        <div className="mt-8 space-y-4">
          {steps.map((item, index) => (
            <div key={item.title} className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${index <= stepIndex ? "border-white bg-white text-ink" : "border-white/20 bg-transparent text-white/60"}`}>
                {index + 1}
              </div>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-white/62">{item.fields.join(" · ")}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-3xl bg-white/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/55">Demo presets</p>
          <div className="mt-4 space-y-3">
            {founderPresets.map((preset, index) => (
              <button
                key={preset.label}
                type="button"
                aria-pressed={selectedPresetLabel === preset.label}
                className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition ${
                  selectedPresetLabel === preset.label
                    ? "border-white/35 bg-white/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
                onClick={() => applyPreset(index)}
              >
                <p className="font-medium">{preset.label}</p>
                <p className="mt-1 text-sm text-white/68">{preset.blurb}</p>
              </button>
            ))}
          </div>
          {selectedPresetLabel ? (
            <p className="mt-3 text-xs font-medium text-white/80">Applied preset: {selectedPresetLabel}</p>
          ) : null}
        </div>
      </Card>

      <Card className="bg-card/90">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Badge>{step.title}</Badge>
            <CardTitle className="mt-4">Progressive founder onboarding</CardTitle>
            <CardDescription className="mt-2">
              Capture your context once, then generate a full founder dashboard in one submit.
            </CardDescription>
          </div>
          <div className="min-w-[120px] text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
            <p className="font-display text-3xl">{Math.round(progress)}%</p>
          </div>
        </div>

        <div className="mb-8 h-3 overflow-hidden rounded-full bg-muted">
          <motion.div
            animate={{ width: `${progress}%` }}
            className="h-full rounded-full bg-[linear-gradient(90deg,#0f6a74,#ff7a1a)]"
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>

        <motion.div
          key={step.title}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="grid gap-5 text-foreground md:grid-cols-2"
        >
          {stepIndex === 0 ? (
            <>
              <div>
                <Label htmlFor="locationCity">Location city</Label>
                <Input id="locationCity" value={form.locationCity} onChange={(event) => updateField("locationCity", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" value={form.industry} onChange={(event) => updateField("industry", event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="idea">Startup idea</Label>
                <Textarea id="idea" value={form.idea} onChange={(event) => updateField("idea", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="stage">Stage</Label>
                <select id="stage" className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25" value={form.stage} onChange={(event) => updateField("stage", event.target.value as FounderIntake["stage"])}>
                  {stageOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="locationLat">Latitude</Label>
                  <Input id="locationLat" type="number" value={String(form.locationLat)} onChange={(event) => updateField("locationLat", Number(event.target.value))} />
                </div>
                <div>
                  <Label htmlFor="locationLng">Longitude</Label>
                  <Input id="locationLng" type="number" value={String(form.locationLng)} onChange={(event) => updateField("locationLng", Number(event.target.value))} />
                </div>
              </div>
            </>
          ) : null}

          {stepIndex === 1 ? (
            <>
              <div className="md:col-span-2">
                <Label htmlFor="challenge">Biggest challenge</Label>
                <Textarea id="challenge" value={form.challenge} onChange={(event) => updateField("challenge", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="fundingStatus">Funding status</Label>
                <Input id="fundingStatus" value={form.fundingStatus} onChange={(event) => updateField("fundingStatus", event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="background">Founder background</Label>
                <Textarea id="background" value={form.background} onChange={(event) => updateField("background", event.target.value)} />
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
              <div>
                <Label htmlFor="category">Priority resource category</Label>
                <select id="category" className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25" value={form.category ?? ""} onChange={(event) => updateField("category", (event.target.value || undefined) as FounderIntake["category"])}>
                  <option value="">Any category</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="cityFilter">City filter</Label>
                <Input id="cityFilter" value={form.cityFilter ?? ""} onChange={(event) => updateField("cityFilter", event.target.value || undefined)} />
              </div>
              <div>
                <Label htmlFor="topN">Top recommendations</Label>
                <Input id="topN" type="number" min={1} max={8} value={String(form.topN)} onChange={(event) => updateField("topN", Number(event.target.value))} />
              </div>
            </>
          ) : null}
        </motion.div>

        {error ? <p className="mt-6 text-sm font-medium text-destructive">{error}</p> : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={previousStep} disabled={stepIndex === 0 || isPending}>
            Back
          </Button>
          {isLast ? (
            <Button size="lg" onClick={submit} disabled={isPending}>
              {isPending ? "Building dashboard..." : "Generate founder dashboard"}
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
