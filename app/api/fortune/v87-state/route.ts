import { NextResponse } from "next/server";

import { getFortuneExtraStateV87 } from "@/lib/fortune/v87-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json(
      { configured: false, error: "not_authenticated" },
      { status: 401 },
    );
  }

  const gameId = new URL(request.url).searchParams.get("gameId");
  const state = await getFortuneExtraStateV87(gameId);

  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
