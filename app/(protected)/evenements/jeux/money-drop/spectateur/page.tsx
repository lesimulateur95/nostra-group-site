import { redirect } from "next/navigation";

import { MoneyDropExperience } from "@/components/money-drop/money-drop-experience";
import { getMoneyDropPublicState } from "@/lib/money-drop/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MoneyDropSpectatorPage() {
  const state = await getMoneyDropPublicState();
  if (!state.configured || !state.settings.enabled || !state.settings.spectator_enabled) {
    redirect("/evenements/jeux");
  }
  return <MoneyDropExperience state={state} successMessage={null} errorMessage={null} spectator />;
}
