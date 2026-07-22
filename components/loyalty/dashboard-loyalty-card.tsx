import { DashboardCard } from "@/components/dashboard/dashboard-card";

export function DashboardLoyaltyCard() {
  return (
    <div className="dashboard-module-grid dashboard-module-grid-grouped">
      <DashboardCard
        href="/dashboard/fidelite"
        icon="◆"
        title="Grades de fidélité"
        description="Attribuer ou retirer les cartes Silver, Gold et Black Signature et régler leurs avantages."
      />
      <DashboardCard
        href="/dashboard/plaques"
        icon="▣"
        title="Gestion des commandes de plaques"
        description="Ouvrir ou fermer les commandes, suivre chaque demande et supprimer les commandes souhaitées."
      />
    </div>
  );
}
