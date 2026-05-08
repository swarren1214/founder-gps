"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";

export function Header() {
  const { resolvedTheme, setTheme } = useTheme();
  const { isLoading, isOnboarded } = useOnboardingGate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="inline-flex items-center" aria-label="Founder GPS home">
            <Image
              src={isDark ? "/founder-gps_logo_dark.svg" : "/founder-gps_logo.svg"}
              alt="Founder GPS"
              width={181}
              height={60}
              className="h-10 w-auto"
              priority
            />
          </Link>
        </div>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          {!isLoading && !isOnboarded ? (
            <Link href="/onboarding" className="transition hover:text-foreground">Get started</Link>
          ) : null}
          {!isLoading && isOnboarded ? (
            <>
              <Link href="/dashboard" className="transition hover:text-foreground">Dashboard</Link>
              <Link href="/map" className="transition hover:text-foreground">Map</Link>
              <Link href="/roadmap" className="transition hover:text-foreground">Roadmap</Link>
              <Link href="/profile" className="transition hover:text-foreground">Profile</Link>
            </>
          ) : null}
        </nav>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="h-9 w-9"
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
