import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function ChampionnatF1Page() {
  return <CircuitCategoryOverview
    categoryKey="championnat-f1"
    slug="championnat-f1"
    eyebrow="Compétition"
    title="Championnat F1"
    description="Vue d’ensemble du championnat F1 organisé sur le Nostra Circuit. Chaque rubrique possède maintenant sa propre page et son propre contenu."
    pages={[
      { href: "/circuit/championnat-f1/calendrier", title: "Calendrier", description: "Dates, horaires et manches officielles." },
      { href: "/circuit/championnat-f1/participants", title: "Pilotes & écuries", description: "Participants officiellement engagés." },
      { href: "/circuit/championnat-f1/resultats", title: "Résultats", description: "Résultats publiés après validation." },
    ]}
  />;
}
