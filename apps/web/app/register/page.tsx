"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { getSignedInRedirectTarget } from "@/lib/auth-routing";

export default function RegisterPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuthUser();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirectTarget = getSignedInRedirectTarget(isAuthenticated);
    if (!isLoading && redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [isAuthenticated, isLoading, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName })
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

  return (
    <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardTitle>Create account</CardTitle>
          <CardDescription className="mt-2">Set up your Founder GPS account to continue.</CardDescription>
          <form className="mt-6 space-y-5" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account? <Link className="underline" href="/login">Sign in</Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
