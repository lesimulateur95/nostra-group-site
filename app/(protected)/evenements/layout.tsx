import { SectionLayout } from "@/components/site/section-layout";
import type { SidebarNavItem } from "@/components/site/sidebar-nav";
import { getSectionNavigation } from "@/lib/content/section-navigation";

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseItems = await getSectionNavigation("evenements");
  const items: SidebarNavItem[] = [];

  for (const item of baseItems) {
    if (item.key === "jeux") {
      items.push({
        key: "bingo",
        href: "/evenements/bingo",
        label: "Bingo",
        children: [
          { key: "bingo-overview", href: "/evenements/bingo", label: "Jeu en direct" },
          { key: "bingo-registration", href: "/evenements/bingo/inscription", label: "Acheter mes grilles" },
        ],
      });
      items.push({
        key: "tombola",
        href: "/evenements/tombola",
        label: "Tombola",
        children: [
          { key: "tombola-overview", href: "/evenements/tombola", label: "Vue d’ensemble" },
          { key: "tombola-registration", href: "/evenements/tombola/inscription", label: "Inscription" },
        ],
      });
      continue;
    }
    items.push(item);
  }

  return (
    <SectionLayout title="ÉVÉNEMENTS & JEUX" items={items}>
      {children}
    </SectionLayout>
  );
}
