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
    <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-license-admin-card-grid">
      <DashboardCard
        href="/dashboard/administration/licences"
        icon="🪪"
        title="Administration des licences"
        description="Sélectionner un citoyen, créer n’importe quel type de licence et générer automatiquement son document officiel."
      />
    </div>
  );
}
