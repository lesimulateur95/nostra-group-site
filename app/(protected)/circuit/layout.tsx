import { CircuitStatusBanner } from "@/components/site/circuit-status-banner";
import { SectionLayout } from "@/components/site/section-layout";

const items = [
  {
    href: "/circuit",
    label: "Présentation",
    children: [
      { href: "/circuit", label: "Présentation générale" },
      { href: "/circuit#activites", label: "Nos activités" },
      { href: "/circuit#valeurs", label: "Nos valeurs" },
      { href: "/circuit#installations", label: "Nos installations" },
    ],
  },
  {
    href: "/circuit/administration-sportive",
    label: "Administration sportive",
    children: [
      { href: "/circuit/administration-sportive", label: "Vue d’ensemble" },
      { href: "/circuit/administration-sportive/reglement-licences", label: "Règlement licences pilotes" },
      { href: "/circuit/administration-sportive/tarifs-licences", label: "Tarifs licences pilotes" },
      { href: "/circuit/administration-sportive/homologation-vehicules", label: "Homologation véhicules" },
      { href: "/circuit/administration-sportive/homologation-ecuries", label: "Homologation écuries" },
    ],
  },
  {
    href: "/circuit/journal-officiel",
    label: "Journal officiel",
    children: [
      { href: "/circuit/journal-officiel", label: "Publications officielles" },
      { href: "/circuit/journal-officiel#communiques", label: "Communiqués" },
      { href: "/circuit/journal-officiel#decisions", label: "Décisions" },
      { href: "/circuit/journal-officiel#resultats", label: "Résultats homologués" },
    ],
  },
  {
    href: "/circuit/reservations",
    label: "Réservations",
    children: [
      { href: "/circuit/reservations", label: "Informations" },
      { href: "/circuit/reservations#demande", label: "Demande de créneau" },
      { href: "/circuit/reservations#validees", label: "Réservations validées" },
      { href: "/circuit/reservations#conditions", label: "Conditions d’accès" },
    ],
  },
  {
    href: "/circuit/reglement",
    label: "Règlement",
    children: [
      { href: "/circuit/reglement", label: "Règlement général" },
      { href: "/circuit/reglement#reglement-piste", label: "Règlement en piste" },
    ],
  },
  {
    href: "/circuit/championnat-f1",
    label: "Championnat F1",
    children: [
      { href: "/circuit/championnat-f1", label: "Présentation" },
      { href: "/circuit/championnat-f1#calendrier", label: "Calendrier" },
      { href: "/circuit/championnat-f1#participants", label: "Pilotes & écuries" },
      { href: "/circuit/championnat-f1#resultats", label: "Résultats" },
    ],
  },
  {
    href: "/circuit/championnat-gt3rs",
    label: "Championnat GT3 RS",
    children: [
      { href: "/circuit/championnat-gt3rs", label: "Présentation" },
      { href: "/circuit/championnat-gt3rs#calendrier", label: "Calendrier" },
      { href: "/circuit/championnat-gt3rs#participants", label: "Pilotes" },
      { href: "/circuit/championnat-gt3rs#resultats", label: "Résultats" },
    ],
  },
  {
    href: "/circuit/classement",
    label: "Classements",
    children: [
      { href: "/circuit/classement", label: "Vue d’ensemble" },
      { href: "/circuit/classement#f1", label: "Classement F1" },
      { href: "/circuit/classement#ecuries", label: "Classement écuries" },
      { href: "/circuit/classement#gt3rs", label: "Classement GT3 RS" },
    ],
  },
];

export default function CircuitLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionLayout title="NOSTRA CIRCUIT" items={items}>
      <CircuitStatusBanner />
      {children}
    </SectionLayout>
  );
}
