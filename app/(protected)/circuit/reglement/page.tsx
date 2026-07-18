import { CircuitCategoryOverview } from "@/components/site/circuit-category-overview";

export default function ReglementPage() {
  return <CircuitCategoryOverview
    categoryKey="reglement"
    slug="circuit-reglement"
    eyebrow="Nostra Circuit"
    title="Règlement du Nostra Circuit"
    description="Règlement général applicable à toute personne entrant sur le site du Nostra Circuit. Le règlement en piste possède maintenant sa propre page."
    pages={[
      { href: "/circuit/reglement/piste", title: "Règlement en piste", description: "Consignes applicables aux courses, sessions et retours aux stands." },
    ]}
  />;
}
