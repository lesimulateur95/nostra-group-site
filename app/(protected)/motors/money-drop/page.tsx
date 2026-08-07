import { redirect } from "next/navigation";

import { MoneyDropExperience } from "@/components/money-drop/money-drop-experience";
import { getMoneyDropPublicState } from "@/lib/money-drop/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    money_drop_success?: string;
    money_drop_error?: string;
  }>;
};

function successLabel(value: string | undefined) {
  if (value === "allocations-saved") return "La répartition a été enregistrée et synchronisée avec la régie.";
  if (value === "registered") return "Ton inscription Money Drop est enregistrée.";
  if (value === "registration-withdrawn") return "Ton inscription a été retirée.";
  if (value === "joined") return "Tu as rejoint l’équipe avec le code de partie.";
  if (value === "joker-used") return "Le joker a été utilisé et synchronisé avec la régie.";
  return null;
}

function errorLabel(value: string | undefined) {
  if (!value) return null;
  const decoded = decodeURIComponent(value).toLowerCase();

  if (decoded.includes("not_player")) {
    return "Seuls les membres de l’équipe sélectionnée peuvent répartir la cagnotte.";
  }
  if (decoded.includes("allocations_total")) {
    return "Toute la cagnotte doit être placée sur les trappes avant validation.";
  }
  if (decoded.includes("timer_expired")) {
    return "Le chronomètre est terminé. La régie doit maintenant verrouiller les mises.";
  }
  if (decoded.includes("question_closed")) {
    return "La répartition est actuellement fermée par la régie.";
  }
  if (decoded.includes("invalid_option")) return "Une somme a été placée sur une trappe qui n’existe pas pour cette question.";
  if (decoded.includes("registration_closed")) return "Les inscriptions publiques sont actuellement fermées.";
  if (decoded.includes("invalid_join_code")) return "Ce code de partie est invalide ou la partie a déjà commencé.";
  if (decoded.includes("team_full")) return "Cette équipe est déjà complète.";
  if (decoded.includes("joker_already_used")) return "Ce joker a déjà été utilisé pendant cette partie.";
  if (decoded.includes("joker_unavailable_final")) return "Le joker Indice n’est pas disponible pendant la finale.";
  if (decoded.includes("jokers_disabled")) return "Les jokers sont désactivés par la régie.";
  return "L’action Money Drop n’a pas pu être enregistrée. Vérifie l’état de la partie puis réessaie.";
}

export default async function MoneyDropPage({ searchParams }: PageProps) {
  const [state, params] = await Promise.all([
    getMoneyDropPublicState(),
    searchParams,
  ]);

  if (!state.configured || !state.settings.enabled) {
    redirect("/motors");
  }

  return (
    <MoneyDropExperience
      state={state}
      successMessage={successLabel(params.money_drop_success)}
      errorMessage={errorLabel(params.money_drop_error)}
    />
  );
}
