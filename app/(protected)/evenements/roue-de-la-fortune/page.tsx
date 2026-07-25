import { redirect } from "next/navigation";

import { FortuneV87Experience } from "@/components/fortune/fortune-v87-experience";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getFortuneCitizens,
  getFortuneManagerRounds,
  getFortunePublicState,
} from "@/lib/fortune/data";
import {
  getFortuneExtraStateV87,
  getFortuneHistoryV87,
  getFortunePuzzleBankV87,
  getFortuneSegmentsV87,
} from "@/lib/fortune/v87-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    fortune_success?: string;
    fortune_error?: string;
  }>;
};

function successLabel(value: string | undefined): string | null {
  if (value === "game-created") {
    return "La partie a été créée avec le nombre de joueurs choisi.";
  }
  if (value === "game-auto-created") {
    return "Les joueurs ont été tirés au sort et la partie a été créée.";
  }
  if (value?.startsWith("round-") && value.endsWith("-saved")) {
    return "L’énigme de la manche a été enregistrée.";
  }
  if (value === "round-started") return "La manche est lancée.";
  if (value === "round-advanced") return "La manche suivante est prête.";
  if (value === "final-saved") return "L’énigme finale est enregistrée.";
  if (value === "segment-updated" || value === "special-segment-updated") {
    return "La case de la roue a été modifiée.";
  }
  if (value === "player-changed") return "Le joueur actif a été modifié.";
  if (value === "letter-found") {
    return "Bonne lettre : la cagnotte et le jackpot ont été mis à jour.";
  }
  if (value === "letter-missed") {
    return "La lettre est absente : le tour passe au joueur suivant.";
  }
  if (value === "letter-revealed") {
    return "La lettre a été révélée manuellement sur le tableau.";
  }
  if (value === "solution-correct") {
    return "Bonne proposition : la manche est remportée.";
  }
  if (value === "solution-wrong") {
    return "Mauvaise proposition : le tour passe au joueur suivant.";
  }
  if (value === "game-cancelled") return "La partie a été annulée.";
  if (value === "puzzle-added") return "L’énigme a été ajoutée à la banque.";
  if (value === "puzzle-enabled") return "L’énigme a été réactivée.";
  if (value === "puzzle-disabled") return "L’énigme a été désactivée.";
  if (value === "random-round-puzzle") {
    return "Une énigme aléatoire a été affectée à la manche.";
  }
  if (value === "random-final-puzzle") {
    return "Une énigme aléatoire a été affectée à la finale.";
  }
  if (value === "timer-started") return "Le chronomètre est lancé.";
  if (value === "timer-stopped") return "Le chronomètre est arrêté.";
  if (value === "buzzer-reset") return "Le buzzer est réarmé.";
  if (value === "buzzer-pressed") return "Le buzzer a été enregistré.";
  if (value === "special-resolved") {
    return "L’action de la case spéciale a été appliquée.";
  }
  if (value === "visibility-updated" || value?.startsWith("wheel-")) {
    return "L’affichage public du jeu a été modifié.";
  }
  return null;
}

function errorLabel(value: string | undefined): string | null {
  if (!value) return null;
  const decoded = decodeURIComponent(value).toLowerCase();

  if (decoded.includes("not_active_player")) {
    return "Cette action est réservée au joueur actif.";
  }
  if (decoded.includes("wheel_hidden")) {
    return "La roue concernée est cachée par la Direction.";
  }
  if (decoded.includes("round_solution_missing")) {
    return "Enregistre l’énigme avant de démarrer la manche.";
  }
  if (decoded.includes("segment_locked")) {
    return "La roue normale est verrouillée pendant une manche active.";
  }
  if (decoded.includes("letter_already_used")) {
    return "Cette lettre a déjà été proposée.";
  }
  if (decoded.includes("not_enough_money")) {
    return "La cagnotte de manche est insuffisante pour cette voyelle.";
  }
  if (decoded.includes("not_enough_citizens")) {
    return "Il n’y a pas assez de citoyens différents pour ce tirage.";
  }
  if (decoded.includes("buzzer_closed")) {
    return "Le buzzer est fermé ou quelqu’un a déjà buzzé.";
  }
  if (decoded.includes("special_target")) {
    return "Choisis une personne valide pour cette case spéciale.";
  }
  if (decoded.includes("players")) {
    return "Sélectionne entre 1 et 6 citoyens différents.";
  }
  return "L’action n’a pas pu être enregistrée. Vérifie l’état de la partie.";
}

export default async function FortunePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const [state, params, roles, history] = await Promise.all([
    getFortunePublicState(),
    searchParams,
    getUserRoleKeys(authData.user),
    getFortuneHistoryV87(),
  ]);

  const isManager = roles.includes("manager");
  const [citizens, managerRounds, puzzles, segments, initialExtra] =
    await Promise.all([
      isManager ? getFortuneCitizens() : Promise.resolve([]),
      isManager
        ? getFortuneManagerRounds(state.game?.id ?? null)
        : Promise.resolve([]),
      isManager ? getFortunePuzzleBankV87() : Promise.resolve([]),
      isManager ? getFortuneSegmentsV87() : Promise.resolve([]),
      getFortuneExtraStateV87(state.game?.id ?? null),
    ]);

  return (
    <FortuneV87Experience
      state={state}
      isManager={isManager}
      citizens={citizens}
      managerRounds={managerRounds}
      successMessage={successLabel(params.fortune_success)}
      errorMessage={errorLabel(params.fortune_error)}
      puzzles={puzzles}
      history={history}
      segments={segments}
      initialExtra={initialExtra}
    />
  );
}
