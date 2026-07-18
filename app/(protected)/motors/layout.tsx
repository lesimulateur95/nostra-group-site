import { SectionLayout } from "@/components/site/section-layout";

const items = [
  { href: "/motors", label: "Présentation" },
  { href: "/motors/catalogue", label: "Catalogue" },
  { href: "/motors/fidelite", label: "Programme fidélité" },
  { href: "/motors/contact", label: "Contact & commandes" },
];

export default function MotorsLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout title="NOSTRA MOTORS" items={items}>{children}</SectionLayout>;
}
