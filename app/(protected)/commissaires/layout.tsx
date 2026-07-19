import { redirect } from "next/navigation";
import { SectionLayout } from "@/components/site/section-layout";
import { hasCommissionerAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const commissionerNavigation = [
  { href: "/commissaires/reglement", label: "Règlement des commissaires" },
  { href: "/commissaires/briefing-avant-course", label: "Planning course en direct" },
  { href: "/commissaires/incidents-circuit", label: "Rapports d’incident" },
];

export default async function CommissionersLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user || !(await hasCommissionerAccess(data.user))) {
    redirect("/accueil");
  }

  return <SectionLayout title="COMMISSAIRES" items={commissionerNavigation}>{children}</SectionLayout>;
}
