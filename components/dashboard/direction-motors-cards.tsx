import { DashboardCard } from "@/components/dashboard/dashboard-card";

export function DirectionMotorsCards() {
  return (
    <div
      className="dashboard-module-grid dashboard-module-grid-grouped"
      style={{ marginBottom: "1rem" }}
    >
      <DashboardCard
        href="/dashboard/top-ventes"
        icon="★"
        title="Véhicules en top vente"
        description="Ajouter ou retirer les véhicules affichés sur l’accueil."
      />
    </div>
  );
}
