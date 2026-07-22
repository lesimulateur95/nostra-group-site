export const dynamic = "force-dynamic";
export const revalidate = 0;

import type {
  SidebarNavItem,
} from "@/components/site/sidebar-nav";
import { MotorsStatusBanner } from "@/components/site/motors-status-banner";
import { SectionLayout } from "@/components/site/section-layout";
import {
  getSectionNavigation,
} from "@/lib/content/section-navigation";

const catalogChildren: SidebarNavItem["children"] = [
  {
    key: "catalog-standard",
    href: "/motors/catalogue",
    label: "Catalogue principal",
  },
  {
    key: "catalog-heavy",
    href: "/motors/catalogue/poids-lourds",
    label: "Catalogue poids lourd",
  },
  {
    key: "catalog-exclusive",
    href: "/motors/catalogue/vehicules-exclusifs",
    label: "Catalogue véhicules exclusifs",
  },
];

function addCatalogChildren(
  items: SidebarNavItem[],
): SidebarNavItem[] {
  return items.map((item) => {
    if (item.key !== "catalogue") {
      return item;
    }

    const customChildren = (item.children ?? []).filter(
      (child) =>
        child.key !== "builtin-catalogue" &&
        child.key !== "catalog-standard" &&
        child.key !== "catalog-heavy" &&
        child.key !== "catalog-exclusive",
    );

    return {
      ...item,
      href: "/motors/catalogue",
      children: [
        ...(catalogChildren ?? []),
        ...customChildren,
      ],
    };
  });
}

export default async function MotorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation =
    await getSectionNavigation("motors");

  return (
    <SectionLayout
      title="NOSTRA MOTORS"
      items={addCatalogChildren(navigation)}
    >
      <MotorsStatusBanner />
      {children}
    </SectionLayout>
  );
}
