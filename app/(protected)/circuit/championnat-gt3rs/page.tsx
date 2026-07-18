import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function ChampionnatGt3RsPage() {
  return <CircuitCategoryOverview
    categoryKey="championnat-gt3rs"
    slug="championnat-gt3rs"
    eyebrow="Compétition"
    title="Championnat Porsche GT3 RS"
    description="Vue d’ensemble du championnat Porsche GT3 RS. Chaque rubrique possède sa propre page modifiable."
    pages={[
      { href: "/circuit/championnat-gt3rs/calendrier", title: "Calendrier", description: "Dates, horaires et manches officielles." },
      { href: "/circuit/championnat-gt3rs/participants", title: "Pilotes", description: "Pilotes officiellement engagés." },
      { href: "/circuit/championnat-gt3rs/resultats", title: "Résultats", description: "Résultats publiés après validation." },
    ]}
  />;
}
