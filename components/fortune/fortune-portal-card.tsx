import { FortunePortalCardClient } from "@/components/fortune/fortune-portal-card-client";
import { getFortunePublicState } from "@/lib/fortune/data";

export async function FortunePortalCard() {
  const state = await getFortunePublicState();
  if (!state.configured || !state.settings.enabled) return null;

  return (
    <FortunePortalCardClient
      jackpot={state.settings.jackpot_amount}
      status={state.game?.status ?? null}
    />
  );
}
