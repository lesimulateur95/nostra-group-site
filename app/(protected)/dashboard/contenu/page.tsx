import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardContentHubPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        title="Modification des pages"
        description="Choisis d’abord la grande partie du site que tu souhaites modifier. Les pages ne sont plus mélangées dans une seule liste."
      />

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">CHOIX DE LA CATÉGORIE</p>
        <h2>Quelle partie du site veux-tu modifier ?</h2>
        <p>Chaque bouton ouvre uniquement les pages de la catégorie choisie.</p>
      </section>

      <section className="dashboard-module-grid dashboard-content-choice-grid">
        <DashboardCard
          href="/dashboard/contenu/motors"
          icon="NM"
          title="Modification Nostra Motors"
          description="Présentation, catalogue, fidélité, contact et commandes."
        />
        <DashboardCard
          href="/dashboard/contenu/circuit"
          icon="🏁"
          title="Modification Nostra Circuit"
          description="Toutes les pages et sous-pages du circuit, les championnats et les classements."
        />
        <DashboardCard
          href="/dashboard/contenu/evenements"
          icon="🎮"
          title="Modification Jeux & Événements"
          description="Présentation, agenda, jeux et inscriptions."
        />
      </section>
    </DashboardShell>
  );
}
