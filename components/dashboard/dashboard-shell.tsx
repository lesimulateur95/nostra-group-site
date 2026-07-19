import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Topbar } from "@/components/site/topbar";
import { getUserRoleKeys, type RoleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function DashboardShell({
  children,
  allowedRoles = ["manager"],
}: {
  children: ReactNode;
  allowedRoles?: RoleKey[];
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => allowedRoles.includes(role))) redirect("/accueil");

  return (
    <div className="site-shell">
      <Topbar />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
