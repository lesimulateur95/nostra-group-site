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
  if (value === "allocations-saved") {
    return "La répartition a été enregistrée et synchronisée avec la régie.";
  }
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
  if (decoded.includes("empty_door_required")) {
    return "Au moins une trappe disponible doit rester vide.";
  }
  if (decoded.includes("timer_expired")) {
    return "Le chronomètre est terminé. La régie doit maintenant verrouiller les mises.";
  }
  if (decoded.includes("question_closed")) {
    return "La répartition est actuellement fermée par la régie.";
  }
  if (decoded.includes("invalid_option")) {
    return "Une somme a été placée sur une trappe qui n’existe pas pour cette question.";
  }
  return "La répartition n’a pas pu être enregistrée. Vérifie les montants puis réessaie.";
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
