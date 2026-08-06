import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MoneyDropManager } from "@/components/money-drop/money-drop-manager";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getMoneyDropCitizens,
  getMoneyDropManagerState,
  getMoneyDropQuestions,
} from "@/lib/money-drop/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    money_drop_success?: string;
    money_drop_error?: string;
  }>;
};

function successLabel(value: string | undefined) {
  if (value === "enabled") return "Money Drop est maintenant visible côté citoyens.";
  if (value === "disabled") return "Money Drop est désactivé et totalement masqué côté citoyens.";
  if (value === "settings-saved") return "Les paramètres de l’émission sont enregistrés.";
  if (value === "question-added") return "La question a été ajoutée à la banque.";
  if (value === "question-updated") return "La disponibilité de la question a été modifiée.";
  if (value === "game-created") return "La nouvelle équipe Money Drop a été créée.";
  if (value === "question-selected") return "La question est chargée pour la manche actuelle.";
  if (value === "question-opened") return "La répartition est ouverte aux joueurs.";
  if (value === "allocations-locked") return "Les mises sont verrouillées.";
  if (value === "answer-revealed") return "Les mauvaises trappes ont été ouvertes.";
  if (value === "round-advanced") return "La manche suivante est prête.";
  if (value === "game-cancelled") return "La partie a été fermée.";
  return null;
}

function errorLabel(value: string | undefined) {
  if (!value) return null;
  const decoded = decodeURIComponent(value).toLowerCase();

  if (decoded.includes("settings")) return "Vérifie la cagnotte, le nombre de manches et le chronomètre.";
  if (decoded.includes("question_in_use")) return "Cette question est déjà utilisée par la partie en cours.";
  if (decoded.includes("question")) return "La question doit contenir entre deux et quatre réponses valides.";
  if (decoded.includes("players")) return "Sélectionne entre un et quatre citoyens différents.";
  if (decoded.includes("allocations_missing")) return "Les joueurs doivent d’abord placer toute la cagnotte.";
  if (decoded.includes("active_game_exists")) return "Une partie est déjà active. Ferme-la avant d’en créer une nouvelle.";
  if (decoded.includes("no_question_available")) return "Aucune question active et encore inutilisée n’est disponible.";
  return "L’action n’a pas pu être enregistrée. Vérifie l’état de la partie.";
}

export default async function MoneyDropDashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const [state, citizens, questions, params] = await Promise.all([
    getMoneyDropManagerState(),
    getMoneyDropCitizens(),
    getMoneyDropQuestions(),
    searchParams,
  ]);

  return (
    <DashboardShell>
      <DashboardHeader
        eyebrow="NOSTRA MOTORS — JEU UNIQUE"
        title="Money Drop"
        description="Pilote l’émission, prépare les questions, synchronise les trappes et contrôle la visibilité civile depuis un seul écran."
      />

      {successLabel(params.money_drop_success) && (
        <div className="dashboard-feedback dashboard-feedback-success">
          {successLabel(params.money_drop_success)}
        </div>
      )}
      {errorLabel(params.money_drop_error) && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {errorLabel(params.money_drop_error)}
        </div>
      )}

      <MoneyDropManager state={state} citizens={citizens} questions={questions} />
    </DashboardShell>
  );
}
