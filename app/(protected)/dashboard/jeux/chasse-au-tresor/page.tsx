import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TreasureHuntAdmin } from "@/components/games/treasure-hunt-admin";
import { getAllTreasureHunts } from "@/lib/treasure-hunt/data";

export default async function TreasureHuntDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const hunts = await getAllTreasureHunts();

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader
        eyebrow="ÉVÉNEMENTS NOSTRA GROUP"
        title="Chasses au trésor"
        description="Créer une chasse, ajouter autant d’indices que nécessaire et les révéler progressivement aux citoyens."
      />
      <TreasureHuntAdmin
        hunts={hunts}
        success={params.success}
        error={params.error}
      />
    </DashboardShell>
  );
}
