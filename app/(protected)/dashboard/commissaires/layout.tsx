import { redirect } from "next/navigation";

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

  return children;
}
