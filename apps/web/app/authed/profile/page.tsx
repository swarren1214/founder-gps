"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CircleX,
  FileText,
  Mail,
  ImagePlus,
  MapPin,
  Phone,
  UploadCloud,
  User,
  UserCircle2,
  Users,
  Briefcase,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { broadcastAuthUserRefresh, useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleTitle: string;
  bio: string;
  address: string;
};

function emptySafe(value: string | null | undefined): string {
  return value ?? "";
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

export default function ProfilePage() {
  const router = useRouter();
  const { isLoading, authUser } = useAuthUser();
  const [notice, setNotice] = useState<string | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isUploadingAvatar, startUploadingAvatar] = useTransition();
  const [isRemovingAvatar, startRemovingAvatar] = useTransition();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const ALLOWED_AVATAR_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
  ]);
  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

  const initialForm = useMemo<ProfileFormState | null>(() => {
    if (!authUser) {
      return null;
    }

    return {
      firstName: emptySafe(authUser.profile.firstName),
      lastName: emptySafe(authUser.profile.lastName),
      email: emptySafe(authUser.user.email),
      phone: formatPhone(
        emptySafe(
          typeof authUser.profile.onboardingContext?.identity === "object" &&
            authUser.profile.onboardingContext.identity !== null &&
            "phone" in authUser.profile.onboardingContext.identity
            ? String((authUser.profile.onboardingContext.identity as Record<string, unknown>).phone ?? "")
            : ""
        )
      ),
      roleTitle: emptySafe(authUser.profile.roleTitle),
      bio: emptySafe(authUser.profile.bio),
      address: emptySafe(authUser.profile.locationCity)
    };
  }, [authUser]);

  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState<ProfileFormState | null>(null);

  if (initialForm !== null) {
    if (form === null) {
      setForm(initialForm);
    }

    if (savedFormSnapshot === null) {
      setSavedFormSnapshot(initialForm);
    }
  }

  function updateField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  const hasProfileChanges = useMemo(() => {
    if (!form || !savedFormSnapshot) {
      return false;
    }

    return (
      form.firstName !== savedFormSnapshot.firstName ||
      form.lastName !== savedFormSnapshot.lastName ||
      form.email !== savedFormSnapshot.email ||
      normalizePhoneDigits(form.phone) !== normalizePhoneDigits(savedFormSnapshot.phone) ||
      form.address !== savedFormSnapshot.address ||
      form.roleTitle !== savedFormSnapshot.roleTitle ||
      form.bio !== savedFormSnapshot.bio
    );
  }, [form, savedFormSnapshot]);

  function humanizeEmailHandle(email: string | null | undefined): string {
    if (!email) {
      return "Founder";
    }

    const handle = email.split("@")[0]?.trim();
    if (!handle) {
      return "Founder";
    }

    return handle
      .replace(/[._-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function saveProfile() {
    if (!form || !authUser) {
      return;
    }

    startSaving(async () => {
      try {
        setNotice(null);
        const response = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName || null,
            lastName: form.lastName || null,
            roleTitle: form.roleTitle || null,
            bio: form.bio || null,
            locationCity: form.address || null,
            onboardingContext: {
              ...authUser.profile.onboardingContext,
              identity: {
                ...(typeof authUser.profile.onboardingContext?.identity === "object" &&
                authUser.profile.onboardingContext.identity !== null
                  ? (authUser.profile.onboardingContext.identity as Record<string, unknown>)
                  : {}),
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email,
                phone: normalizePhoneDigits(form.phone)
              }
            }
          })
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? payload?.error ?? "Failed to save profile.");
        }

        setSavedFormSnapshot({ ...form, phone: formatPhone(form.phone) });
        setNotice("Profile saved.");
        broadcastAuthUserRefresh();
        router.refresh();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to save profile.");
      }
    });
  }

  function uploadAvatar() {
    if (!avatarFile) {
      setAvatarNotice("Choose an avatar file first.");
      return;
    }

    startUploadingAvatar(async () => {
      try {
        setAvatarNotice(null);
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
        if (avatarInputRef.current) {
          avatarInputRef.current.value = "";
        }
        setAvatarNotice(null);
        broadcastAuthUserRefresh();
        router.refresh();
      } catch (error) {
        setAvatarNotice(error instanceof Error ? error.message : "Failed to upload avatar.");
      }
    });
  }

  function removeAvatar() {
    startRemovingAvatar(async () => {
      try {
        setAvatarNotice(null);
        const response = await fetch("/api/auth/avatar", { method: "DELETE" });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error?.message ?? json?.error ?? "Failed to remove avatar.");
        }

        setAvatarFile(null);
        if (avatarInputRef.current) {
          avatarInputRef.current.value = "";
        }
        setAvatarNotice("Avatar removed.");
        broadcastAuthUserRefresh();
        router.refresh();
      } catch (error) {
        setAvatarNotice(error instanceof Error ? error.message : "Failed to remove avatar.");
      }
    });
  }

  function setAvatarFromFile(file: File | null) {
    if (!file) {
      setAvatarFile(null);
      setAvatarNotice(null);
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setAvatarFile(null);
      setAvatarNotice("Unsupported file type. Use PNG, JPG, WEBP, or GIF.");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarFile(null);
      setAvatarNotice("Avatar must be 2 MB or smaller.");
      return;
    }

    setAvatarFile(file);
    setAvatarNotice(null);
  }

  function handleAvatarChange(file: File | null) {
    setAvatarFromFile(file);
  }

  function handleAvatarDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    setAvatarFromFile(event.dataTransfer.files?.[0] ?? null);
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

  const personName = [authUser.profile.firstName, authUser.profile.lastName].filter(Boolean).join(" ").trim();
  const companyName = authUser.profile.companyName?.trim() ?? "";
  const emailBasedName = humanizeEmailHandle(authUser.user.email);
  const avatarDisplayName = personName || companyName || emailBasedName;
  const avatarFallbackInitials = avatarDisplayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hasStoredAvatar = Boolean(authUser.profile.avatarUrl || authUser.profile.avatarStorageKey);
  const shouldShowAvatarNotice = Boolean(avatarNotice && !avatarNotice.startsWith("Selected "));

  return (
    <main className="page-shell min-h-screen bg-linear-to-b from-background to-muted/30 px-5 py-10 md:px-10 lg:px-14">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href="/authed/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
          <Badge className="bg-secondary/15 text-secondary">
            <BadgeCheck className="mr-1 h-3.5 w-3.5" />
            Profile
          </Badge>
        </div>

        <Card className="border-border/80 bg-card/95 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCircle2 className="h-5 w-5 text-secondary" />
                Account profile settings
              </CardTitle>
              <CardDescription className="mt-2">
                Manage your account details, onboarding status, and avatar.
              </CardDescription>
            </div>

            {hasProfileChanges ? (
              <Button type="button" onClick={saveProfile} disabled={isSaving}>
                <UserCircle2 className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
            ) : null}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
            <section className="flex h-full flex-col rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <ImagePlus className="h-3.5 w-3.5" />
                Avatar
              </p>
              <div className="mt-4 flex flex-col items-center gap-3 text-center">
                <Avatar className="size-32 border border-border/70">
                  <AvatarImage src={authUser.profile.avatarUrl ?? undefined} alt={avatarDisplayName} />
                  <AvatarFallback>{avatarFallbackInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{avatarDisplayName}</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, GIF up to 2MB</p>
                </div>
              </div>

              <div
                className={cn(
                  "mt-4 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors",
                  isDragActive
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
                  setIsDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
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
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => handleAvatarChange(event.target.files?.[0] ?? null)}
              />

              {avatarFile ? (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  <span className="truncate pr-3">{avatarFile.name} ({Math.ceil(avatarFile.size / 1024)} KB)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-md"
                    aria-label="Clear selected file"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarNotice(null);
                      if (avatarInputRef.current) {
                        avatarInputRef.current.value = "";
                      }
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}

              {shouldShowAvatarNotice ? (
                <Alert className="mt-3 border-border/70 bg-background/70">
                  <AlertDescription>{avatarNotice}</AlertDescription>
                </Alert>
              ) : null}

              {avatarFile || hasStoredAvatar ? (
                <div className="mt-auto pt-4 flex flex-wrap gap-2">
                  {avatarFile ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={uploadAvatar}
                      disabled={isUploadingAvatar}
                    >
                      <UploadCloud className="h-4 w-4" />
                      {isUploadingAvatar ? "Uploading..." : "Upload avatar"}
                    </Button>
                  ) : null}
                  {hasStoredAvatar ? (
                    <Button type="button" variant="ghost" onClick={removeAvatar} disabled={isRemovingAvatar}>
                      <Trash2 className="h-4 w-4" />
                      {isRemovingAvatar ? "Removing..." : "Remove"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    First name
                  </Label>
                  <Input
                    id="firstName"
                    value={form.firstName ?? ""}
                    onChange={(event) => updateField("firstName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Last name
                  </Label>
                  <Input
                    id="lastName"
                    value={form.lastName ?? ""}
                    onChange={(event) => updateField("lastName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input id="email" value={form.email ?? ""} disabled readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={form.phone ?? ""}
                    inputMode="tel"
                    placeholder="(555) 123-4567"
                    onChange={(event) => updateField("phone", formatPhone(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={form.address ?? ""}
                    onChange={(event) => updateField("address", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleTitle" className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    Role title
                  </Label>
                  <Input
                    id="roleTitle"
                    value={form.roleTitle ?? ""}
                    onChange={(event) => updateField("roleTitle", event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bio" className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Bio
                  </Label>
                  <Textarea
                    id="bio"
                    rows={6}
                    value={form.bio ?? ""}
                    onChange={(event) => updateField("bio", event.target.value)}
                  />
                </div>
              </div>

              {notice ? (
                <Alert className="mt-4 border-border/70 bg-muted/35">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              ) : null}
            </section>
          </div>
        </Card>
      </div>
    </main>
  );
}
