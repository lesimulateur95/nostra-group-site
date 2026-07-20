import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function ClassementPage() {
  return <CircuitCategoryOverview
    categoryKey="classements"
    slug="classements"
    eyebrow="Résultats officiels"
    title="Classements"
    description="Vue d’ensemble des classements officiels du Nostra Circuit. Chaque classement est maintenant indépendant."
    pages={[
      { href: "/circuit/classement/f1", title: "Classement F1", description: "Classement général des pilotes F1." },
      { href: "/circuit/classement/ecuries", title: "Classement des écuries", description: "Classement général des écuries." },
      { href: "/circuit/classement/gt3rs", title: "Classement GT3 RS", description: "Classement général Porsche GT3 RS." },
      { href: "/circuit/classement/evenements", title: "Classement événements", description: "Classement général des événements spéciaux du Nostra Circuit." },
      { href: "/circuit/classement/contre-la-montre", title: "Chrono contre la montre", description: "Meilleurs chronos enregistrés sur chaque parcours." },
      { href: "/circuit/classement/records-tour", title: "Records tour circuit", description: "Records homologués sur les différents tracés du circuit." },
    ]}
  />;
}
