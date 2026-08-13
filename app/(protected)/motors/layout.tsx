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
    key: "catalog-concession",
    href: "/motors/catalogue/concession",
    label: "Catalogue concession",
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
  {
    key: "catalog-used",
    href: "/motors/catalogue/vehicules-occasion",
    label: "Véhicules d’occasion",
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
        child.key !== "catalog-concession" &&
        child.key !== "catalog-heavy" &&
        child.key !== "catalog-exclusive" &&
        child.key !== "catalog-used",
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

function addShowroom(items: SidebarNavItem[]): SidebarNavItem[] {
  if (items.some((item) => item.key === "showroom")) return items;

  const catalogueIndex = items.findIndex((item) => item.key === "catalogue");
  const showroomItem: SidebarNavItem = {
    key: "showroom",
    href: "/motors/showroom",
    label: "Showroom",
  };

  if (catalogueIndex < 0) return [showroomItem, ...items];

  return [
    ...items.slice(0, catalogueIndex),
    showroomItem,
    ...items.slice(catalogueIndex),
  ];
}

function addV134Services(items: SidebarNavItem[]): SidebarNavItem[] {
  const keys = new Set(items.map((item) => item.key));
  return [
    ...items,
    ...(!keys.has("mandat-recherche")
      ? [{ key: "mandat-recherche", href: "/motors/mandat-recherche", label: "Mandat de recherche" }]
      : []),
    ...(!keys.has("depot-vente")
      ? [{ key: "depot-vente", href: "/motors/depot-vente", label: "Dépôt-vente" }]
      : []),
  ];
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
      items={addV134Services(addShowroom(addCatalogChildren(navigation)))}
    >
      <MotorsStatusBanner />
      {children}
    </SectionLayout>
  );
}
