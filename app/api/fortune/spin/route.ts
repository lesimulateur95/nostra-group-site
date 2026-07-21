import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const source = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const gameId = typeof source.gameId === "string" ? source.gameId : "";
  if (!gameId) return NextResponse.json({ error: "missing_game" }, { status: 400 });

  const { data: result, error } = await (supabase as any).rpc(
    "fortune_spin_wheel",
    { p_game_id: gameId },
  );
  if (error) {
    return NextResponse.json({ error: error.message || "spin_failed" }, { status: 400 });
  }
  return NextResponse.json(result);
}
