"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthScreenSkeleton } from "@/components/ui/loading-screens";
import { useAuthUser } from "@/hooks/use-auth-user";
import { getSignedInRedirectTarget } from "@/lib/auth-routing";
import { useTheme } from "@/components/theme-provider";
import { Lock, Mail, Moon, Sun, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { isLoading, isAuthenticated } = useAuthUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const redirectTarget = getSignedInRedirectTarget(isAuthenticated);
    if (!isLoading && redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <AuthScreenSkeleton />;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? payload?.error ?? "Registration failed.");
      }

      router.replace("/authed/onboarding");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDark = resolvedTheme === "dark";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_85%_20%,hsl(var(--card)),transparent_30%)]" />

      <div className="absolute right-5 top-5 md:right-8 md:top-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur"
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          aria-label="Toggle theme"
        >
          {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-xl">
        <Card className="border-border/60 bg-card/95 p-7 shadow-2xl md:p-8">
          <div className="mb-5 flex justify-center">
            <Image
              src={isDark ? "/founder-gps_logo_dark.svg" : "/founder-gps_logo.svg"}
              alt="Founder GPS"
              width={181}
              height={60}
              className="h-10 w-auto"
              priority
            />
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-11"
                  required
                />
              </div>
            </div>

            {error ? <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

            <Button type="submit" size="lg" disabled={isSubmitting} className="h-fit w-full rounded-2xl p-3 text-sm font-semibold">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account? <Link className="font-medium underline underline-offset-4" href="/login">Sign in</Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
