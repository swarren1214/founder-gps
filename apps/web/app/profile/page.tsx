"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { founderFlowResponseSchema, type FounderIntake } from "@/lib/schemas";
import { clearDashboardRun, saveDashboardRun } from "@/lib/session";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const stageOptions = ["idea", "validation", "mvp", "launched", "traction", "fundraising", "scale"] as const;
const categoryOptions = ["community", "investor", "university", "coworking", "accelerator", "incubator"] as const;

export default function ProfilePage() {
  const router = useRouter();
  const { isLoading, isOnboarded, run } = useOnboardingGate();
  const [isSaving, startSaving] = useTransition();
  const [isRegenerating, startRegenerating] = useTransition();
  const [form, setForm] = useState<FounderIntake | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace("/onboarding");
    }
  }, [isLoading, isOnboarded, router]);

  useEffect(() => {
    if (run) {
      setForm(run.founderProfile);
    }
  }, [run]);

  function updateField<K extends keyof FounderIntake>(key: K, value: FounderIntake[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function saveProfileOnly() {
    if (!run || !form) {
      return;
    }

    startSaving(() => {
      const updatedRun = {
        ...run,
        founderProfile: form
      };
      saveDashboardRun(updatedRun);
      setNotice("Profile saved. Use regenerate when you want refreshed analysis and recommendations.");
    });
  }

  function saveAndRegenerate() {
    if (!form) {
      return;
    }

    startRegenerating(async () => {
      try {
        setNotice(null);
        const response = await fetch("/api/founder-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to regenerate dashboard.");
        }

        const parsed = founderFlowResponseSchema.parse(payload);
        saveDashboardRun(parsed);
        setNotice("Profile saved and dashboard regenerated.");
        router.replace("/dashboard");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to regenerate dashboard.");
      }
    });
  }

  if (isLoading || !form) {
    return (
      <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardTitle>Loading profile...</CardTitle>
            <CardDescription className="mt-3">Preparing your founder profile for edits.</CardDescription>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
      <div className="mx-auto max-w-4xl">
        <Card>
          <Badge className="mb-4">Profile</Badge>
          <CardTitle>Founder profile settings</CardTitle>
          <CardDescription className="mt-2">
            Update your profile here after onboarding. Save only to keep details in sync, or regenerate to refresh dashboard outputs.
          </CardDescription>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
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
              <Label htmlFor="challenge">Biggest challenge</Label>
              <Textarea id="challenge" value={form.challenge} onChange={(event) => updateField("challenge", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="background">Founder background</Label>
              <Textarea id="background" value={form.background} onChange={(event) => updateField("background", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="fundingStatus">Funding status</Label>
              <Input id="fundingStatus" value={form.fundingStatus} onChange={(event) => updateField("fundingStatus", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <select id="stage" className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25" value={form.stage} onChange={(event) => updateField("stage", event.target.value as FounderIntake["stage"])}>
                {stageOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="category">Priority resource category</Label>
              <select id="category" className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25" value={form.category ?? "community"} onChange={(event) => updateField("category", event.target.value as FounderIntake["category"])}>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cityFilter">City filter</Label>
              <Input id="cityFilter" value={form.cityFilter ?? ""} onChange={(event) => updateField("cityFilter", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="topN">Top recommendations</Label>
              <Input id="topN" type="number" min={1} max={8} value={String(form.topN)} onChange={(event) => updateField("topN", Number(event.target.value))} />
            </div>
            <div>
              <Label htmlFor="locationLat">Latitude</Label>
              <Input id="locationLat" type="number" value={String(form.locationLat)} onChange={(event) => updateField("locationLat", Number(event.target.value))} />
            </div>
            <div>
              <Label htmlFor="locationLng">Longitude</Label>
              <Input id="locationLng" type="number" value={String(form.locationLng)} onChange={(event) => updateField("locationLng", Number(event.target.value))} />
            </div>
          </div>

          {notice ? <p className="mt-6 text-sm text-muted-foreground">{notice}</p> : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={saveProfileOnly} disabled={isSaving || isRegenerating}>
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
            <Button onClick={saveAndRegenerate} disabled={isSaving || isRegenerating}>
              {isRegenerating ? "Regenerating..." : "Save and regenerate dashboard"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clearDashboardRun();
                router.replace("/onboarding");
              }}
              disabled={isSaving || isRegenerating}
            >
              Restart onboarding
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
