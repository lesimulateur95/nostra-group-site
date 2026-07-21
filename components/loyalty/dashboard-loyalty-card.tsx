import { DashboardCard } from "@/components/dashboard/dashboard-card";

export function DashboardLoyaltyCard() {
  return (
    <div
      className="dashboard-module-grid dashboard-module-grid-grouped"
      style={{ marginBottom: "1rem" }}
    >
      <DashboardCard
        href="/dashboard/fidelite"
        icon="◆"
        title="Grades de fidélité"
        description="Attribuer ou retirer les cartes Silver, Gold et Black Signature, régler le tarif des plaques et gérer les commandes de plaques."
      />
    </div>
  );
}
