import { SectionLayout } from "@/components/site/section-layout";

const items = [
  { href: "/circuit", label: "Présentation" },
  { href: "/circuit/administration-sportive", label: "Administration sportive" },
  { href: "/circuit/journal-officiel", label: "Journal officiel" },
  { href: "/circuit/reservations", label: "Réservations" },
  { href: "/circuit/reglement", label: "Règlement" },
  { href: "/circuit/championnat-f1", label: "Championnat F1" },
  { href: "/circuit/championnat-gt3rs", label: "Championnat GT3 RS" },
  { href: "/circuit/classement", label: "Classements" },
];

export default function CircuitLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionLayout title="NOSTRA CIRCUIT" items={items}>
      {children}
    </SectionLayout>
  );
}
