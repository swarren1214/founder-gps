import Link from "next/link";
import { ArrowRight, MapPinned, Route, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const pillars = [
  {
    title: "Founder analysis",
    body: "Structured AI identifies stage, immediate needs, and blind spots before any map lights up."
  },
  {
    title: "Resource ranking",
    body: "Deterministic recommendation scoring keeps the product reliable while still feeling intelligent."
  },
  {
    title: "Founder Path",
    body: "OSRM turns your short list into a practical route across Utah's startup ecosystem."
  }
];

export default function HomePage() {
  return (
    <main className="page-shell min-h-screen px-5 py-8 md:px-10 lg:px-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex items-center justify-between rounded-full border border-white/60 bg-white/70 px-5 py-3 shadow-panel backdrop-blur-sm">
          <div>
            <p className="font-display text-lg font-semibold">Founder GPS</p>
            <p className="text-xs uppercase tracking-[0.18em] text-ink/55">Utah navigation layer</p>
          </div>
          <nav className="hidden items-center gap-5 text-sm text-ink/72 md:flex">
            <Link href="/onboarding">Onboarding</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/map">Map</Link>
            <Link href="/roadmap">Roadmap</Link>
          </nav>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="relative overflow-hidden bg-[linear-gradient(145deg,#11203b,#18365f)] p-8 text-white md:p-12">
            <div className="absolute inset-0 bg-grain opacity-80" />
            <div className="relative flex flex-col gap-7">
              <Badge className="w-fit border-white/20 bg-white/10 text-white">Phase 5 in motion</Badge>
              <div className="max-w-3xl space-y-5">
                <h1 className="font-display text-4xl leading-tight md:text-6xl">
                  Stop guessing your next move. Start with a clear founder route.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/78 md:text-lg">
                  Founder GPS turns your founder context into prioritized Utah resources, an optimized route, and a practical 30-day action plan you can execute today.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/onboarding">
                  <Button size="lg" className="min-w-[190px]">
                    Start founder intake
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="ghost" size="lg" className="border border-white/20 text-white hover:bg-white/10">
                    Open dashboard preview
                  </Button>
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/12 bg-white/8 p-4">
                  <Sparkles className="mb-3 h-5 w-5" />
                  <p className="text-sm text-white/78">Structured, explainable analysis with confidence scoring.</p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/8 p-4">
                  <MapPinned className="mb-3 h-5 w-5" />
                  <p className="text-sm text-white/78">Map view that makes nearby ecosystem options instantly legible.</p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/8 p-4">
                  <Route className="mb-3 h-5 w-5" />
                  <p className="text-sm text-white/78">OSRM-driven Founder Path optimized for real-world momentum.</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6">
            {pillars.map((pillar) => (
              <Card key={pillar.title} className="bg-white/72">
                <CardTitle>{pillar.title}</CardTitle>
                <CardDescription className="mt-3">{pillar.body}</CardDescription>
              </Card>
            ))}
            <Card className="bg-[#ffefe0]">
              <CardTitle>Demo-ready flow</CardTitle>
              <CardDescription className="mt-3">
                From intake to dashboard, every step is connected: analysis, ranking, routing, and roadmap generation.
              </CardDescription>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
