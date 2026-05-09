"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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

  const avatarUrl = authUser?.profile.avatarUrl ?? undefined;
  const personName = [authUser?.profile.firstName, authUser?.profile.lastName].filter(Boolean).join(" ").trim();
  const profileDisplayName = authUser?.profile.displayName?.trim() ?? "";
  const companyName = authUser?.profile.companyName?.trim() ?? "";
  const emailBasedName = humanizeEmailHandle(authUser?.user.email);
  const displayLooksLikeCompany =
    profileDisplayName.length > 0 &&
    companyName.length > 0 &&
    profileDisplayName.toLowerCase() === companyName.toLowerCase();
  const displayName = personName || (displayLooksLikeCompany ? emailBasedName : profileDisplayName) || emailBasedName;
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10 rounded-full p-0">
                <Avatar className="size-9 transition-transform hover:scale-105">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-secondary/20 text-secondary">{fallbackInitials}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Open user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{displayName}</span>
                  <span className="text-xs text-muted-foreground">Account menu</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={profileHref}>Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </header>
  );
}
