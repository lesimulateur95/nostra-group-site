import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getFortunePublicState } from "@/lib/fortune/data";

function statusBadge(
  configured: boolean,
  enabled: boolean,
  status: string | null,
): string | undefined {
  if (!configured) return "V45 à activer";
  if (!enabled) return "Désactivée";
  if (status === "active") return "Partie en cours";
  if (status === "finale") return "Manche finale";
  if (status === "between_rounds") return "Entre deux manches";
  if (status === "setup") return "À préparer";
  return undefined;
}

export async function DashboardFortuneCard() {
  const state = await getFortunePublicState();

  return (
    <div
      className="dashboard-module-grid dashboard-module-grid-grouped"
      style={{ marginBottom: "1rem" }}
    >
      <DashboardCard
        href="/evenements/roue-de-la-fortune"
        icon="🎡"
        title="Roue de la Fortune"
        description="Ouvrir la partie en direct et accéder au cadran rouge du Gérant pour gérer les joueurs, les énigmes, les roues et les manches."
        badge={statusBadge(
          state.configured,
          state.settings.enabled,
          state.game?.status ?? null,
        )}
      />
    </div>
  );
}
