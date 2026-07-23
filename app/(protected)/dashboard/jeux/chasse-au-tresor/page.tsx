import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TreasureHuntAdmin } from "@/components/games/treasure-hunt-admin";
import {
  getAllTreasureHunts,
  getTreasureHuntSettings,
} from "@/lib/treasure-hunt/data";

export default async function TreasureHuntDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [hunts, settings] = await Promise.all([
    getAllTreasureHunts(),
    getTreasureHuntSettings(),
  ]);

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader
        eyebrow="ÉVÉNEMENTS NOSTRA GROUP"
        title="Chasses au trésor"
        description="Activer ou masquer le jeu, créer une chasse et révéler progressivement autant d’indices que nécessaire."
      />
      <TreasureHuntAdmin
        hunts={hunts}
        enabled={settings.is_enabled}
        success={params.success}
        error={params.error}
      />
    </DashboardShell>
  );
}
