"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Moon, Sun } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth-user";

export function Header() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";
  const profileHref = "/authed/profile";
  const avatarUrl = authUser?.profile.avatarUrl ?? undefined;
  const displayName = authUser?.profile.displayName ?? "Founder";
  const fallbackInitials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

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

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>

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

          <Link href={profileHref} aria-label="Open profile">
            <Avatar className="size-9 transition-transform hover:scale-105">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="bg-secondary/20 text-secondary">{fallbackInitials}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
