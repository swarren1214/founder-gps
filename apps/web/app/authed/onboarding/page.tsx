"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FounderIntakeForm } from "@/components/onboarding/founder-intake-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingScreenSkeleton } from "@/components/ui/loading-screens";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useTheme } from "@/components/theme-provider";
import { LogOut, Moon, Sun } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { isLoading, authUser } = useAuthUser();
  const isOnboarded = authUser?.profile.onboardingStatus === "completed";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && isOnboarded) {
      router.replace("/authed/dashboard");
    }
  }, [isLoading, isOnboarded, router]);

  if (isLoading) {
    return <OnboardingScreenSkeleton />;
  }

  if (!isLoading && isOnboarded) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_84%_16%,hsl(var(--card)),transparent_30%)]" />
        <div className="absolute right-5 top-5 z-20 flex items-center gap-2 md:right-8 md:top-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur"
            title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/login");
              router.refresh();
            }}
            className="h-10 rounded-full bg-background/80 px-4 backdrop-blur"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardTitle>Onboarding already complete</CardTitle>
            <CardDescription className="mt-3">
              Taking you to your dashboard. You can update details later from Profile.
            </CardDescription>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_84%_16%,hsl(var(--card)),transparent_30%)]" />
      <div className="absolute right-5 top-5 z-20 flex items-center gap-2 md:right-8 md:top-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur"
          title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle theme"
        >
          {mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button
          variant="outline"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/login");
            router.refresh();
          }}
          className="h-10 rounded-full bg-background/80 px-4 backdrop-blur"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <FounderIntakeForm />
      </div>
    </main>
  );
}
