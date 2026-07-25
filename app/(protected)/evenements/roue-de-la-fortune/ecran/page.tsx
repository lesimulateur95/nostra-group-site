import { redirect } from "next/navigation";

import { FortuneTvDisplay } from "@/components/fortune/fortune-tv-display";
import { getFortunePublicState } from "@/lib/fortune/data";
import { getFortuneExtraStateV87 } from "@/lib/fortune/v87-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FortuneTvPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const state = await getFortunePublicState();
  const extra = await getFortuneExtraStateV87(state.game?.id ?? null);

  return <FortuneTvDisplay initialState={state} initialExtra={extra} />;
}
