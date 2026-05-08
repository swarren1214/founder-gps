import { FounderIntakeForm } from "@/components/onboarding/founder-intake-form";

export default function OnboardingPage() {
  return (
    <main className="page-shell min-h-screen px-5 py-10 md:px-10 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <FounderIntakeForm />
      </div>
    </main>
  );
}
