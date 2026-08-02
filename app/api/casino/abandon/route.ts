/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const ACTIVE_GAMES = new Set(["poker", "blackjack", "double_or_quit", "mines"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const game = String(body.game ?? "");
  if (!ACTIVE_GAMES.has(game)) {
    return NextResponse.json({ error: "Cette partie ne peut pas être abandonnée." }, { status: 400 });
  }

  const { data: result, error } = await (supabase as any).rpc("casino_abandon_active_game_v132", {
    p_game: game,
  });

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    return NextResponse.json({
      error: message.includes("function") || message.includes("schema cache")
        ? "Exécute le SQL Casino V132 dans Supabase."
        : "La sortie de la partie n’a pas pu être enregistrée. Réessaie.",
    }, { status: 400 });
  }

  return NextResponse.json({
    abandoned: result?.abandoned === true,
    balance: Math.max(0, Math.trunc(Number(result?.balance ?? 0))),
  });
}
