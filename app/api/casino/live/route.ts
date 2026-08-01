/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getCasinoSettings } from "@/lib/casino/data";
import { createClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };
  const [settings, roles] = await Promise.all([getCasinoSettings(), getUserRoleKeys(data.user)]);
  if (!settings.publicEnabled && !roles.includes("manager")) return { error: NextResponse.json({ error: "Le casino est fermé." }, { status: 403 }) };
  return { supabase };
}

async function lobby(supabase: Awaited<ReturnType<typeof createClient>>) {
  await (supabase as any).rpc("casino_live_recover_v119");
  const { data, error } = await (supabase as any).rpc("casino_live_lobby_v119");
  if (error) throw new Error(String(error.message));
  return data;
}

function friendly(error: unknown): string {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (message.includes("insufficient_balance")) return "Tu n’as pas assez de jetons pour cette mise.";
  if (message.includes("active_live_table")) return "Tu participes déjà à une table live active.";
  if (message.includes("table_full")) return "Cette table est complète.";
  if (message.includes("table_unavailable")) return "Cette table n’est plus disponible.";
  if (message.includes("invalid_code")) return "Le code privé est incorrect.";
  if (message.includes("not_host")) return "Seul le créateur de la table peut lancer ou fermer la partie.";
  if (message.includes("players_not_ready")) return "Chaque citoyen doit poser sa mise avant le lancement.";
  if (message.includes("not_your_turn")) return "Ce n’est pas encore à toi de jouer.";
  if (message.includes("bet_already_locked")) return "Ta mise est déjà verrouillée pour cette manche.";
  if (message.includes("wager_out_of_bounds")) return "Cette mise ne respecte pas les limites de la Direction.";
  if (message.includes("game_closed")) return "Cette table est fermée par la Direction.";
  if (message.includes("function") || message.includes("schema cache")) return "Exécute le SQL Casino V119 dans Supabase avant d’utiliser les tables live.";
  return "La table live n’a pas pu traiter cette action. Réessaie.";
}

export async function GET() {
  const current = await context();
  if ("error" in current) return current.error;
  try { return NextResponse.json(await lobby(current.supabase)); }
  catch (error) { return NextResponse.json({ error: friendly(error) }, { status: 400 }); }
}

export async function POST(request: Request) {
  const current = await context();
  if ("error" in current) return current.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  try {
    if (action === "create") {
      const { error } = await (current.supabase as any).rpc("casino_live_create_v119", {
        p_game: String(body.game ?? ""), p_name: String(body.name ?? "").slice(0,42),
        p_max_players: Math.trunc(Number(body.capacity)), p_visibility: String(body.visibility ?? "public"),
      });
      if (error) throw new Error(String(error.message));
    } else if (action === "join") {
      const { error } = await (current.supabase as any).rpc("casino_live_join_v119", {
        p_table_id: String(body.tableId ?? "") || null,
        p_code: String(body.code ?? "").trim().toUpperCase().slice(0,8) || null,
      });
      if (error) throw new Error(String(error.message));
    } else if (action === "bet") {
      const bets = Array.isArray(body.bets) ? body.bets.slice(0,64) : null;
      const amount = bets ? bets.reduce((sum: number, bet: { value?: unknown }) => sum + Math.max(0,Math.trunc(Number(bet?.value ?? 0))),0) : Math.max(0,Math.trunc(Number(body.amount)));
      const { error } = await (current.supabase as any).rpc("casino_live_bet_v119", {
        p_table_id: String(body.tableId ?? ""), p_amount: amount,
        p_choice: String(body.choice ?? "").slice(0,16) || null, p_bets: bets,
      });
      if (error) throw new Error(String(error.message));
    } else if (action === "start") {
      const { error } = await (current.supabase as any).rpc("casino_live_start_v119", { p_table_id: String(body.tableId ?? "") });
      if (error) throw new Error(String(error.message));
    } else if (action === "blackjack_action") {
      const play = String(body.play ?? "");
      if (!["hit","stand"].includes(play)) return NextResponse.json({ error:"Action de blackjack inconnue." },{status:400});
      const { error } = await (current.supabase as any).rpc("casino_live_blackjack_action_v119", { p_table_id:String(body.tableId ?? ""), p_action:play });
      if (error) throw new Error(String(error.message));
    } else if (action === "new_round") {
      const { error } = await (current.supabase as any).rpc("casino_live_new_round_v119", { p_table_id:String(body.tableId ?? "") });
      if (error) throw new Error(String(error.message));
    } else if (action === "cancel") {
      const { error } = await (current.supabase as any).rpc("casino_live_cancel_v119", { p_table_id:String(body.tableId ?? "") });
      if (error) throw new Error(String(error.message));
    } else if (action === "leave") {
      const { error } = await (current.supabase as any).rpc("casino_live_leave_v119", { p_table_id:String(body.tableId ?? "") });
      if (error) throw new Error(String(error.message));
    } else return NextResponse.json({ error:"Action inconnue." },{status:400});
    return NextResponse.json(await lobby(current.supabase));
  } catch (error) { return NextResponse.json({ error:friendly(error) },{status:400}); }
}
