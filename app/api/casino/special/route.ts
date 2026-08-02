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
  await (supabase as any).rpc("casino_special_recover_v131");
  const { data, error } = await (supabase as any).rpc("casino_special_lobby_v131");
  if (error) throw new Error(String(error.message));
  return data;
}

function friendly(error: unknown): string {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (message.includes("insufficient_balance")) return "Tu n’as pas assez de jetons.";
  if (message.includes("active_special_room")) return "Termine d’abord ta partie multijoueur en cours.";
  if (message.includes("table_full")) return "Cette partie est complète.";
  if (message.includes("table_unavailable")) return "Cette partie n’est plus disponible.";
  if (message.includes("invalid_code")) return "Le code privé est incorrect.";
  if (message.includes("not_host")) return "Seul le créateur peut lancer ou annuler cette partie.";
  if (message.includes("players_not_ready")) return "Tous les participants doivent avoir placé leur mise.";
  if (message.includes("turns_remaining")) return "Tous les citoyens n’ont pas encore terminé leurs tours.";
  if (message.includes("bet_already_locked")) return "Ta mise est déjà verrouillée.";
  if (message.includes("game_closed")) return "Ce jeu est fermé par la Direction.";
  if (message.includes("wager_out_of_bounds")) return "Cette mise ne respecte pas les limites fixées dans le Dashboard.";
  if (message.includes("function") || message.includes("schema cache")) return "Exécute le SQL Casino V131 avant d’utiliser ces jeux.";
  return "La partie n’a pas pu traiter cette action. Réessaie.";
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
      const { error } = await (current.supabase as any).rpc("casino_special_create_v131", {
        p_game: String(body.game ?? ""), p_name: String(body.name ?? "").slice(0, 42),
        p_entry_fee: Math.max(1, Math.trunc(Number(body.entryFee))), p_max_players: Math.trunc(Number(body.capacity)),
        p_visibility: String(body.visibility ?? "public"),
      });
      if (error) throw new Error(String(error.message));
    } else if (action === "join") {
      const { error } = await (current.supabase as any).rpc("casino_special_join_v131", {
        p_room_id: String(body.roomId ?? "") || null,
        p_code: String(body.code ?? "").trim().toUpperCase().slice(0, 8) || null,
      });
      if (error) throw new Error(String(error.message));
    } else if (action === "bet") {
      const { error } = await (current.supabase as any).rpc("casino_special_bet_v131", {
        p_room_id: String(body.roomId ?? ""), p_amount: Math.max(1, Math.trunc(Number(body.amount))),
        p_choice: String(body.choice ?? "").slice(0, 12),
      });
      if (error) throw new Error(String(error.message));
    } else if (action === "start") {
      const { error } = await (current.supabase as any).rpc("casino_special_start_v131", { p_room_id: String(body.roomId ?? "") });
      if (error) throw new Error(String(error.message));
    } else if (action === "spin") {
      const { error } = await (current.supabase as any).rpc("casino_special_spin_v131", { p_room_id: String(body.roomId ?? "") });
      if (error) throw new Error(String(error.message));
    } else if (action === "cancel") {
      const { error } = await (current.supabase as any).rpc("casino_special_cancel_v131", { p_room_id: String(body.roomId ?? "") });
      if (error) throw new Error(String(error.message));
    } else if (action === "leave") {
      const { error } = await (current.supabase as any).rpc("casino_special_leave_v131", { p_room_id: String(body.roomId ?? "") });
      if (error) throw new Error(String(error.message));
    } else return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    return NextResponse.json(await lobby(current.supabase));
  } catch (error) { return NextResponse.json({ error: friendly(error) }, { status: 400 }); }
}
