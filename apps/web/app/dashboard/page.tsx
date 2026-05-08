import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardPage() {
  return (
    <main className="page-shell min-h-screen overflow-x-hidden">
      <div className="w-full">
        <DashboardShell />
      </div>
    </main>
  );
}
