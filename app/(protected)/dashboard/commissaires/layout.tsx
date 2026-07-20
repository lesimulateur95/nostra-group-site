import { redirect } from "next/navigation";

import { CommissionerBackLinkFix } from "@/components/commissaires/commissioner-back-link-fix";
import { hasCommissionerAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export default async function CommissionerToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user || !(await hasCommissionerAccess(data.user))) {
    redirect("/accueil");
  }

  return (
    <>
      <CommissionerBackLinkFix />
      {children}
    </>
  );
}
