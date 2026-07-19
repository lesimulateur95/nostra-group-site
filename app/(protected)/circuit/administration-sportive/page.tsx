import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function AdministrationSportivePage() {
  return <CircuitCategoryOverview
    categoryKey="administration-sportive"
    slug="administration-sportive"
    eyebrow="Nostra Circuit"
    title="Administration sportive"
    description="Vue d’ensemble des règlements, licences, créations d’écuries et procédures d’homologation officielles."
    pages={[
      { href: "/circuit/administration-sportive/creation-ecurie", title: "Création d’écurie", description: "Inscription F1, GT3 RS ou double inscription aux deux championnats." },
      { href: "/circuit/administration-sportive/reglement-licences", title: "Règlement des licences pilotes", description: "Conditions d’obtention, obligations et sanctions." },
      { href: "/circuit/administration-sportive/tarifs-licences", title: "Tarifs des licences pilotes", description: "Tarifs officiels et informations de délivrance." },
      { href: "/circuit/administration-sportive/homologation-vehicules", title: "Homologation des véhicules", description: "Règlement et formulaire de demande." },
      { href: "/circuit/administration-sportive/homologation-ecuries", title: "Homologation des écuries", description: "Règlement et formulaire de création." },
    ]}
  />;
}
