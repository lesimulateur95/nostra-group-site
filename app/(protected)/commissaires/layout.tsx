import { redirect } from "next/navigation";

import { SectionLayout } from "@/components/site/section-layout";
import { hasCommissionerAccess } from "@/lib/auth/access";
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

export default async function CommissionersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (
    !data.user ||
    !(await hasCommissionerAccess(data.user))
  ) {
    redirect("/accueil");
  }

  return (
    <SectionLayout
      title="Espace Commissaire"
      items={commissionerNavigation}
    >
      {children}
    </SectionLayout>
  );
}
