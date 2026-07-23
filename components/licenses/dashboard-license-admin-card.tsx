import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function DashboardLicenseAdminCard() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) return null;

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) return null;

  return (
    <>
      <DashboardCard
        href="/dashboard/administration/licences"
        icon="🪪"
        title="Licences officielles"
        description="Créer, modifier et annuler les licences officielles des citoyens."
      />
      <DashboardCard
        href="/dashboard/discipline-circuit"
        icon="⚖️"
        title="Discipline Nostra Circuit"
        description="Avertissements, pénalités, suspensions, points et historique complet."
      />
    </>
  );
}
