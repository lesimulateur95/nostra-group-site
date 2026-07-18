import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function JournalOfficielPage() {
  return <CircuitCategoryOverview
    categoryKey="journal-officiel"
    slug="journal-officiel"
    eyebrow="Publications officielles"
    title="Journal officiel"
    description="Vue d’ensemble des publications du Nostra Circuit. Les communiqués, décisions et résultats sont séparés."
    pages={[
      { href: "/circuit/journal-officiel/communiques", title: "Communiqués", description: "Annonces officielles de la direction." },
      { href: "/circuit/journal-officiel/decisions", title: "Décisions", description: "Décisions sportives et administratives." },
      { href: "/circuit/journal-officiel/resultats", title: "Résultats homologués", description: "Résultats validés après les épreuves." },
    ]}
  />;
}
