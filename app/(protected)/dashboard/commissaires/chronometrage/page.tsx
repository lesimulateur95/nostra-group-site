import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  RaceControlSetupPageContent,
  type RaceControlSetupSearchParams,
} from "@/components/race-control/race-control-setup-page";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RaceControlSetupPage({
  searchParams,
}: {
  searchParams: Promise<RaceControlSetupSearchParams>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);

  if (!roles.includes("manager")) {
    if (roles.includes("commissioner")) {
      redirect("/commissaires/chronometrage");
    }

    redirect("/accueil");
  }

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <RaceControlSetupPageContent
        searchParams={searchParams}
        basePath="/dashboard/commissaires/chronometrage"
        backPath="/dashboard"
        backLabel="Retour au Dashboard"
      />
    </DashboardShell>
  );
}
