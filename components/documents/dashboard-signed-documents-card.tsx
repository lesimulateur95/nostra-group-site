import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function DashboardSignedDocumentsCard() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const roles = await getUserRoleKeys(data.user);
  const hasAccess = roles.some((role) =>
    ["manager", "commercial", "employee"].includes(role),
  );

  if (!hasAccess) return null;

  return (
    <div className="dashboard-signed-documents-card-grid">
      <DashboardCard
        href="/dashboard/documents-signes"
        icon="✍️"
        title="Stock des documents signés"
        description="Consulter les licences, certificats, factures, contrats et bons de commande signés par les citoyens."
      />
    </div>
  );
}
