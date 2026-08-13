import { SectionLayout } from "@/components/site/section-layout";
import type { SidebarNavItem } from "@/components/site/sidebar-nav";
import { getSectionNavigation } from "@/lib/content/section-navigation";
import { getMoneyDropPublicState } from "@/lib/money-drop/data";
import { PoleMaintenanceGuard } from "@/components/v153/pole-maintenance-guard";

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [baseItems, moneyDropState] = await Promise.all([
    getSectionNavigation("evenements"),
    getMoneyDropPublicState(),
  ]);
  const moneyDropVisible = moneyDropState.configured && moneyDropState.settings.enabled;
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
      if (moneyDropVisible) {
        items.push({
          key: "money-drop",
          href: "/evenements/jeux/money-drop",
          label: "Money Drop",
          children: [
            { key: "money-drop-live", href: "/evenements/jeux/money-drop", label: "Plateau de jeu" },
            { key: "money-drop-registration", href: "/evenements/jeux/money-drop/inscription", label: "Inscription" },
            ...(moneyDropState.settings.spectator_enabled
              ? [{ key: "money-drop-spectator", href: "/evenements/jeux/money-drop/spectateur", label: "Écran spectateur" }]
              : []),
          ],
        });
      }
      items.push({
        key: "deal-or-no-deal",
        href: "/evenements/a-prendre-ou-a-laisser",
        label: "À Prendre ou à Laisser",
      });
      items.push({
        key: "live-events",
        href: "/evenements/evenements-en-direct",
        label: "Événements en direct",
      });
      continue;
    }
    items.push(item);
  }

  return (
    <PoleMaintenanceGuard pole="events">
    <SectionLayout title="ÉVÉNEMENTS & JEUX" items={items}>
      {children}
    </SectionLayout>
    </PoleMaintenanceGuard>
  );
}
