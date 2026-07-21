import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getActiveAuctionCount } from "@/lib/auctions/data";

export async function DashboardAuctionCard() {
  const activeCount = await getActiveAuctionCount();

  return (
    <div
      className="dashboard-module-grid dashboard-module-grid-grouped"
      style={{ marginBottom: "1rem" }}
    >
      <DashboardCard
        href="/dashboard/ventes-aux-encheres"
        icon="🔨"
        title="Ventes aux enchères"
        description="Publier un véhicule, choisir le prix de départ et laisser les citoyens enchérir jusqu’à la fin du compteur."
        badge={activeCount > 0 ? `${activeCount} active(s)` : undefined}
      />
    </div>
  );
}
