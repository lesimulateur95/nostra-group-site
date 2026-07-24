import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardLoading() {
  return (
    <DashboardShell>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">NOSTRA GROUP</span>
          <h1 className="page-title">Ouverture du Dashboard…</h1>
          <p className="lead">Chargement des compteurs essentiels.</p>
        </div>
      </section>
    </DashboardShell>
  );
}
