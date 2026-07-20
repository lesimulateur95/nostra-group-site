import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { createClient } from "@/lib/supabase/server";

async function getPendingAppointmentCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await (supabase as any)
      .from("motors_appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function DirectionMotorsCards() {
  const pendingAppointments = await getPendingAppointmentCount();

  return (
    <div
      className="dashboard-module-grid dashboard-module-grid-grouped"
      style={{ marginBottom: "1rem" }}
    >
      <DashboardCard
        href="/dashboard/rendez-vous-motors"
        icon="◷"
        title="Rendez-vous Nostra Motors"
        description="Traiter les visites du showroom et les demandes d’essai."
        badge={
          pendingAppointments > 0
            ? `${pendingAppointments} en attente`
            : undefined
        }
      />

      <DashboardCard
        href="/dashboard/top-ventes"
        icon="★"
        title="Véhicules en top vente"
        description="Ajouter ou retirer les véhicules affichés sur l’accueil."
      />
    </div>
  );
}
