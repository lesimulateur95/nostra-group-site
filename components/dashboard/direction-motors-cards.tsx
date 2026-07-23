import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getPendingPilotLicenseCount } from "@/lib/licenses/data";

export async function DirectionMotorsCards() {
  const pendingLicenses = await getPendingPilotLicenseCount();

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
      <DashboardCard
        href="/dashboard/licences-pilotes"
        icon=""
        title="Demandes de licences pilotes"
        description="Examiner les dossiers, accepter ou refuser une licence et demander un nouveau certificat médical."
        badge={
          pendingLicenses > 0 ? `${pendingLicenses} à traiter` : undefined
        }
      />
      <DashboardCard
        href="/dashboard/favoris-vehicules"
        icon="♡"
        title="Favoris & alertes stock"
        description="Voir les véhicules les plus suivis et les citoyens qui attendent leur retour en stock."
      />
    </div>
  );
}
