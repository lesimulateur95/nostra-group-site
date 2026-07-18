import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function CircuitPage() {
  return <CircuitCategoryOverview
    categoryKey="presentation"
    slug="circuit-presentation"
    eyebrow="Présentation officielle"
    title="Nostra Circuit"
    description="Bienvenue au Nostra Circuit. Cette vue d’ensemble donne accès aux pages détaillées de présentation."
    pages={[
      { href: "/circuit/presentation/activites", title: "Nos activités", description: "Sessions, essais, championnats et événements." },
      { href: "/circuit/presentation/valeurs", title: "Nos valeurs", description: "Sécurité, respect, fair-play et professionnalisme." },
      { href: "/circuit/presentation/installations", title: "Nos installations", description: "Piste, stands, accueil et direction de course." },
    ]}
  />;
}
