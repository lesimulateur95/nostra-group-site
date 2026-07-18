import { SectionLayout } from "@/components/site/section-layout";

const items = [
  { href: "/evenements", label: "Présentation" },
  { href: "/evenements/agenda", label: "Agenda" },
  { href: "/evenements/jeux", label: "Jeux" },
  { href: "/evenements/inscriptions", label: "Inscriptions" },
];

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout title="ÉVÉNEMENTS & JEUX" items={items}>{children}</SectionLayout>;
}
