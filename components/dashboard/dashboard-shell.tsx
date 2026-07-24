import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Topbar } from "@/components/site/topbar";
import { getUserRoleKeys, type RoleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const OPERATIONS_DASHBOARD_PREFIXES = [
  "/dashboard/catalogue",
  "/dashboard/commandes",
  "/dashboard/livraisons",
  "/dashboard/rendez-vous-motors",
  "/dashboard/stocks",
  "/dashboard/reservations",
  "/dashboard/homologations",
  "/dashboard/inscriptions-ecuries",
  "/dashboard/championnats",
] as const;

function isOperationsDashboardPath(pathname: string): boolean {
  return OPERATIONS_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function getAllowedRolesForCurrentPath(): Promise<RoleKey[]> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-nostra-pathname") ?? "";

  if (pathname === "/dashboard" || isOperationsDashboardPath(pathname)) {
    return ["manager", "employee", "commercial"];
  }

  return ["manager"];
}

export async function DashboardShell({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: RoleKey[];
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const [roles, resolvedAllowedRoles] = await Promise.all([
    getUserRoleKeys(data.user),
    allowedRoles
      ? Promise.resolve(allowedRoles)
      : getAllowedRolesForCurrentPath(),
  ]);

  if (!roles.some((role) => resolvedAllowedRoles.includes(role))) {
    redirect("/accueil");
  }

  return (
    <div className="site-shell">
      <Topbar />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
