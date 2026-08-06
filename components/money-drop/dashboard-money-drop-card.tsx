import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getMoneyDropPublicState } from "@/lib/money-drop/data";

function badge(configured: boolean, enabled: boolean, status: string | null) {
  if (!configured) return "V138 à activer";
  if (!enabled) return "Désactivé";
  if (status === "question_open") return "Question en cours";
  if (status === "allocations_locked") return "Mises verrouillées";
  if (status === "revealed") return "Résultat affiché";
  if (status === "finished") return "Partie terminée";
  return undefined;
}

export async function DashboardMoneyDropCard() {
  const state = await getMoneyDropPublicState();

  return (
    <div
      className="dashboard-module-grid dashboard-module-grid-grouped"
      style={{ marginBottom: "1rem" }}
    >
      <DashboardCard
        href="/dashboard/jeux/money-drop"
        icon="💸"
        title="Money Drop"
        description="Activer le jeu, préparer les questions, sélectionner l’équipe et piloter les trappes en direct."
        badge={badge(
          state.configured,
          state.settings.enabled,
          state.game?.status ?? null,
        )}
      />
    </div>
  );
}
