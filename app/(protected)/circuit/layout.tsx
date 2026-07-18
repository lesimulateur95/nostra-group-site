import { SectionLayout } from "@/components/site/section-layout";

const items = [
  { href: "/circuit", label: "Présentation" },
  { href: "/circuit/reservations", label: "Réservations" },
  { href: "/circuit/activites", label: "Activités" },
  { href: "/circuit/reglement", label: "Règlement" },
];

export default function CircuitLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout title="NOSTRA CIRCUIT" items={items}>{children}</SectionLayout>;
}
