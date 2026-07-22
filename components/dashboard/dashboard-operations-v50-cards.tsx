import { DashboardCard } from "@/components/dashboard/dashboard-card";

export function DashboardOperationsV50Cards() {
  return (
    <div className="dashboard-module-grid dashboard-module-grid-grouped">
      <DashboardCard
        href="/dashboard/citoyens"
        icon="👤"
        title="Fiches citoyens"
        description="Identité, rôles, fidélité, commandes, licences, documents, SAV et candidatures réunis."
      />
      <DashboardCard
        href="/dashboard/sav"
        icon="🛠️"
        title="SAV Nostra Motors"
        description="Traiter les dossiers, répondre et suivre leur résolution."
      />
      <DashboardCard
        href="/dashboard/recrutement"
        icon="📋"
        title="Candidatures"
        description="Examiner, accepter, refuser et attribuer un rôle."
      />
    </div>
  );
}
