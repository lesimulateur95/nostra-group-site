import { NextResponse } from "next/server";

import { getFortunePublicState } from "@/lib/fortune/data";
import { getFortuneExtraStateV87 } from "@/lib/fortune/v87-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const state = await getFortunePublicState();
  const extra = await getFortuneExtraStateV87(state.game?.id ?? null);

  return NextResponse.json(
    { state, extra },
    { headers: { "Cache-Control": "no-store" } },
  );
}
