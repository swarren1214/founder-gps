import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Line({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-full rounded-full", className)} />;
}

function Block({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-2xl", className)} />;
}

export function AppLoadingScreen() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.16),transparent_35%),radial-gradient(circle_at_80%_15%,hsl(var(--card)),transparent_30%)]" />
      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-2xl backdrop-blur-sm">
        <div className="space-y-5">
          <div className="mx-auto h-10 w-44 rounded-2xl bg-muted/60" />
          <div className="space-y-3">
            <Line className="w-3/4" />
            <Line className="w-1/2" />
          </div>
          <div className="space-y-3">
            <Block className="h-12" />
            <Block className="h-12" />
          </div>
          <Block className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </main>
  );
}

export function AuthScreenSkeleton() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_80%_15%,hsl(var(--card)),transparent_30%)]" />
      <div className="relative z-10 mx-auto w-full max-w-md rounded-[28px] border border-border/60 bg-card/95 p-7 shadow-2xl backdrop-blur-sm md:p-8">
        <div className="space-y-6">
          <div className="mx-auto h-10 w-44 rounded-2xl bg-muted/60" />
          <div className="space-y-4">
            <Block className="h-12 w-full" />
            <Block className="h-12 w-full" />
          </div>
          <Block className="h-12 w-full rounded-2xl" />
          <Line className="mx-auto w-3/5" />
        </div>
      </div>
    </main>
  );
}

export function OnboardingScreenSkeleton() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-secondary px-5 py-10 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_84%_16%,hsl(var(--card)),transparent_30%)]" />
      <div className="relative z-10 mx-auto w-full max-w-6xl rounded-[28px] border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur-sm md:p-8 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/25 p-4">
            <Block className="h-5 w-24" />
            <div className="grid gap-3">
              <Block className="h-16 w-full" />
              <Block className="h-16 w-full" />
              <Block className="h-16 w-full" />
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/25 p-5">
            <div className="flex items-center gap-4">
              <Block className="h-20 w-20 rounded-full" />
              <div className="flex-1 space-y-3">
                <Line className="w-1/3" />
                <Line className="w-1/2" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Block className="h-14 w-full" />
              <Block className="h-14 w-full" />
              <Block className="h-14 w-full" />
              <Block className="h-14 w-full" />
            </div>
            <Block className="h-32 w-full" />
            <div className="flex justify-end">
              <Block className="h-12 w-40 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function DashboardInlineSkeleton() {
  return (
    <div className="space-y-4 rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-panel backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Line className="w-40" />
          <Line className="w-64" />
        </div>
        <Block className="h-8 w-24 rounded-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Block className="h-24 w-full" />
        <Block className="h-24 w-full" />
      </div>
      <div className="space-y-3">
        <Line className="w-32" />
        <Block className="h-20 w-full" />
        <Block className="h-20 w-full" />
      </div>
    </div>
  );
}

export function DashboardScreenSkeleton() {
  return (
    <main className="relative h-screen overflow-hidden bg-secondary">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_82%_12%,hsl(var(--card)),transparent_30%)]" />
      <div className="absolute inset-4 rounded-[32px] border border-border/60 bg-card/90 shadow-2xl backdrop-blur-sm">
        <div className="grid h-full gap-4 p-4 lg:grid-cols-[420px_1fr]">
          <div className="flex h-full flex-col gap-4 rounded-[28px] border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <Line className="w-28" />
              <Block className="h-8 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-4 gap-2 rounded-2xl bg-muted/60 p-1">
              <Block className="h-9 w-full rounded-xl" />
              <Block className="h-9 w-full rounded-xl" />
              <Block className="h-9 w-full rounded-xl" />
              <Block className="h-9 w-full rounded-xl" />
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-hidden rounded-[24px] border border-border/70 bg-muted/25 p-4">
              <Line className="w-40" />
              <Block className="h-24 w-full" />
              <Block className="h-24 w-full" />
              <Block className="h-24 w-full" />
              <Block className="h-24 w-full" />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-muted/30">
            <Block className="h-full w-full rounded-[28px]" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function MapScreenSkeleton() {
  return (
    <main className="page-shell relative min-h-screen overflow-hidden bg-secondary px-0 py-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)/0.16),transparent_35%),radial-gradient(circle_at_82%_12%,hsl(var(--card)),transparent_30%)]" />
      <div className="absolute inset-0">
        <Block className="h-full w-full rounded-none" />
      </div>
      <div className="absolute left-5 top-5 z-10 w-[360px] rounded-[28px] border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-sm">
        <div className="space-y-4">
          <Line className="w-32" />
          <div className="grid grid-cols-2 gap-3">
            <Block className="h-12 w-full" />
            <Block className="h-12 w-full" />
          </div>
          <Block className="h-24 w-full" />
        </div>
      </div>
    </main>
  );
}

export function ProfileScreenSkeleton() {
  return (
    <main className="page-shell min-h-screen bg-linear-to-b from-background to-muted/30 px-5 py-10 md:px-10 lg:px-14">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <Block className="h-9 w-36 rounded-xl" />
          <Block className="h-8 w-24 rounded-full" />
        </div>
        <div className="rounded-[28px] border border-border/80 bg-card/95 p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Line className="w-64" />
              <Line className="w-80" />
            </div>
            <Block className="h-10 w-32 rounded-2xl" />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/25 p-4">
              <div className="mx-auto flex flex-col items-center gap-3 text-center">
                <Block className="h-32 w-32 rounded-full" />
                <div className="space-y-2">
                  <Line className="w-36" />
                  <Line className="w-40" />
                </div>
              </div>
              <Block className="h-10 w-full rounded-2xl" />
              <Block className="h-10 w-full rounded-2xl" />
            </div>
            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/25 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Block className="h-14 w-full" />
                <Block className="h-14 w-full" />
                <Block className="h-14 w-full" />
                <Block className="h-14 w-full" />
              </div>
              <Block className="h-36 w-full" />
              <Block className="h-10 w-40 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}