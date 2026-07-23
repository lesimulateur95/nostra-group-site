import { redirect } from "next/navigation";

import { SectionLayout } from "@/components/site/section-layout";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const commissionerNavigation = [
  {
    href: "/commissaires",
    label: "Gestion de course",
  },
  {
    href: "/commissaires/chronometrage",
    label: "Chronométrage et tours",
  },
  {
    href: "/commissaires/reglement",
    label: "Règlement des commissaires",
  },
  {
    href: "/commissaires/briefing-avant-course",
    label: "Planning visible par les citoyens",
  },
  {
    href: "/commissaires/incidents-circuit",
    label: "Rapports d’incident",
  },
];

const disciplineNavigationItem = {
  href: "/commissaires/sanctions-disciplinaires",
  label: "Sanctions disciplinaires",
};

export default async function CommissionersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/accueil");
  }

  const roles = await getUserRoleKeys(data.user);
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
