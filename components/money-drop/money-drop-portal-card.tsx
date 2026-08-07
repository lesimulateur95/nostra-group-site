import { MoneyDropPortalCardClient } from "@/components/money-drop/money-drop-portal-card-client";
import { getMoneyDropPublicState } from "@/lib/money-drop/data";

export async function MoneyDropPortalCard() {
  const state = await getMoneyDropPublicState();
  if (!state.configured || !state.settings.enabled) return null;

  return (
    <MoneyDropPortalCardClient
      amount={state.game?.current_amount ?? state.settings.starting_amount}
      status={state.game?.status ?? null}
      round={state.game?.current_round ?? null}
      totalRounds={state.game?.total_rounds ?? state.settings.total_rounds}
      registrationsOpen={state.settings.public_registration_enabled}
    />
  );
}
