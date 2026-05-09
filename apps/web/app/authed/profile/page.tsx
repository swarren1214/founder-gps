"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUser } from "@/hooks/use-auth-user";

type ProfileFormState = {
  displayName: string;
  firstName: string;
  lastName: string;
  companyName: string;
  roleTitle: string;
  bio: string;
  locationCity: string;
  onboardingStatus: "not_started" | "in_progress" | "completed";
};

function emptySafe(value: string | null | undefined): string {
  return value ?? "";
}

export default function ProfilePage() {
  const router = useRouter();
  const { isLoading, authUser } = useAuthUser();
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isUploadingAvatar, startUploadingAvatar] = useTransition();
  const [isRemovingAvatar, startRemovingAvatar] = useTransition();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const initialForm = useMemo<ProfileFormState | null>(() => {
    if (!authUser) {
      return null;
    }

    return {
      displayName: authUser.profile.displayName,
      firstName: emptySafe(authUser.profile.firstName),
      lastName: emptySafe(authUser.profile.lastName),
      companyName: emptySafe(authUser.profile.companyName),
      roleTitle: emptySafe(authUser.profile.roleTitle),
      bio: emptySafe(authUser.profile.bio),
      locationCity: emptySafe(authUser.profile.locationCity),
      onboardingStatus: authUser.profile.onboardingStatus
    };
  }, [authUser]);

  const [form, setForm] = useState<ProfileFormState | null>(null);

  if (form === null && initialForm !== null) {
    setForm(initialForm);
  }

  function updateField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function buildInitials(name: string) {
    const initials = name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return initials || "FG";
  }

  function saveProfile() {
    if (!form) {
      return;
    }

    startSaving(async () => {
      try {
        setNotice(null);
        const response = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: form.displayName,
            firstName: form.firstName || null,
            lastName: form.lastName || null,
            companyName: form.companyName || null,
            roleTitle: form.roleTitle || null,
            bio: form.bio || null,
            locationCity: form.locationCity || null,
            onboardingStatus: form.onboardingStatus
          })
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? payload?.error ?? "Failed to save profile.");
        }

        setNotice("Profile saved.");
        router.refresh();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to save profile.");
      }
    });
  }

  function uploadAvatar() {
    if (!avatarFile) {
      setNotice("Choose an avatar file first.");
      return;
    }

    startUploadingAvatar(async () => {
      try {
        setNotice(null);
        const payload = new FormData();
        payload.append("avatar", avatarFile);

        const response = await fetch("/api/auth/avatar", {
          method: "POST",
          body: payload
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error?.message ?? json?.error ?? "Failed to upload avatar.");
        }

        setAvatarFile(null);
        setNotice("Avatar uploaded.");
        router.refresh();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to upload avatar.");
      }
    });
  }

  function removeAvatar() {
    startRemovingAvatar(async () => {
      try {
        setNotice(null);
        const response = await fetch("/api/auth/avatar", { method: "DELETE" });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error?.message ?? json?.error ?? "Failed to remove avatar.");
        }

        setNotice("Avatar removed.");
        router.refresh();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to remove avatar.");
      }
    });
  }

  if (isLoading || !authUser || !form) {
    return (
      <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardTitle>Loading profile...</CardTitle>
            <CardDescription className="mt-3">Preparing your account settings.</CardDescription>
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
          <CardTitle>Account profile settings</CardTitle>
          <CardDescription className="mt-2">
            Manage your account details, onboarding status, and avatar.
          </CardDescription>

          <div className="mt-8 grid gap-5 md:grid-cols-[auto_1fr]">
            <div className="space-y-3">
              <Avatar className="size-16">
                <AvatarImage src={authUser.profile.avatarUrl ?? undefined} alt={form.displayName} />
                <AvatarFallback>{buildInitials(form.displayName)}</AvatarFallback>
              </Avatar>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={uploadAvatar} disabled={isUploadingAvatar}>
                  {isUploadingAvatar ? "Uploading..." : "Upload avatar"}
                </Button>
                <Button type="button" variant="ghost" onClick={removeAvatar} disabled={isRemovingAvatar}>
                  {isRemovingAvatar ? "Removing..." : "Remove"}
                </Button>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(event) => updateField("displayName", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="locationCity">Location city</Label>
                <Input
                  id="locationCity"
                  value={form.locationCity}
                  onChange={(event) => updateField("locationCity", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(event) => updateField("lastName", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="companyName">Company</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(event) => updateField("companyName", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="roleTitle">Role title</Label>
                <Input
                  id="roleTitle"
                  value={form.roleTitle}
                  onChange={(event) => updateField("roleTitle", event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(event) => updateField("bio", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="onboardingStatus">Onboarding status</Label>
                <select
                  id="onboardingStatus"
                  className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25"
                  value={form.onboardingStatus}
                  onChange={(event) =>
                    updateField(
                      "onboardingStatus",
                      event.target.value as ProfileFormState["onboardingStatus"]
                    )
                  }
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {notice ? <p className="mt-6 text-sm text-muted-foreground">{notice}</p> : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={saveProfile} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
