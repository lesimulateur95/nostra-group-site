import { redirect } from "next/navigation";

import { SectionLayout } from "@/components/site/section-layout";
import { getRequestRoleKeys, getRequestUser } from "@/lib/auth/request-context";

const commissionerNavigation = [
  {
    href: "/commissaires",
    label: "Gestion de course",
    prefetch: false,
  },
  {
    href: "/commissaires/chronometrage",
    label: "Chronométrage et tours",
    prefetch: false,
  },
  {
    href: "/commissaires/reglement",
    label: "Règlement des commissaires",
    prefetch: false,
  },
  {
    href: "/commissaires/briefing-avant-course",
    label: "Planning visible par les citoyens",
    prefetch: false,
  },
  {
    href: "/commissaires/incidents-circuit",
    label: "Rapports d’incident",
    prefetch: false,
  },
  {
    href: "/dashboard/racing-academy",
    label: "Nostra Racing Academy",
    prefetch: false,
  },
];

const disciplineNavigationItem = {
  href: "/commissaires/sanctions-disciplinaires",
  label: "Sanctions disciplinaires",
  prefetch: false,
};

export default async function CommissionersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, roles] = await Promise.all([
    getRequestUser(),
    getRequestRoleKeys(),
  ]);

  if (!user) {
    redirect("/accueil");
  }

  const hasAccess =
    roles.includes("manager") || roles.includes("commissioner");

  if (!hasAccess) {
    redirect("/accueil");
  }

  const navigationItems = roles.includes("manager")
    ? [...commissionerNavigation, disciplineNavigationItem]
    : commissionerNavigation;

  return (
    <SectionLayout title="Espace Commissaire" items={navigationItems}>
      {children}
    </SectionLayout>
  );
}
