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
  if (!settings.publicEnabled && !roles.includes("manager")) {
    return { error: NextResponse.json({ error: "Le casino est fermé." }, { status: 403 }) };
  }
  return { supabase, user: data.user };
}

async function lobby(supabase: Awaited<ReturnType<typeof createClient>>) {
  await (supabase as any).rpc("casino_pvp_recover_v116");
  const { data, error } = await (supabase as any).rpc("casino_pvp_lobby_v116");
  if (error) throw new Error(String(error.message));
  return data;
}

function friendlyError(error: unknown): string {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (message.includes("insufficient_balance")) return "Tu n’as pas assez de jetons pour cette mise.";
  if (message.includes("open_room_exists")) return "Tu as déjà un défi ouvert. Annule-le avant d’en créer un autre.";
  if (message.includes("invalid_code")) return "Le code privé est incorrect.";
  if (message.includes("cannot_join_own_room")) return "Tu ne peux pas rejoindre ton propre défi.";
  if (message.includes("room_unavailable")) return "Ce salon vient d’être rejoint ou n’est plus disponible.";
  if (message.includes("room_not_cancellable")) return "Ce défi ne peut plus être annulé.";
  if (message.includes("wager_out_of_bounds")) return "La mise ne respecte pas les limites réglées dans le Dashboard.";
  if (message.includes("game_closed")) return "Ce jeu est fermé par la Direction.";
  if (message.includes("function") || message.includes("schema cache")) return "Exécute le SQL Casino V116 dans Supabase avant d’ouvrir le multijoueur.";
  return "Le salon n’a pas pu traiter cette action. Réessaie.";
}

export async function GET() {
  const current = await context();
  if ("error" in current) return current.error;
  try {
    return NextResponse.json(await lobby(current.supabase));
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const current = await context();
  if ("error" in current) return current.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    let actionResult: unknown = null;
    if (action === "create") {
      const game = String(body.game ?? "");
      const wager = Math.trunc(Number(body.wager));
      const visibility = String(body.visibility ?? "public");
      const choice = String(body.choice ?? "").slice(0, 16) || null;
      if (!["poker", "dice", "coinflip"].includes(game) || !Number.isFinite(wager)) throw new Error("invalid_room");
      const { data, error } = await (current.supabase as any).rpc("casino_pvp_create_v116", {
        p_game: game,
        p_wager: wager,
        p_visibility: visibility,
        p_choice: choice,
      });
      if (error) throw new Error(String(error.message));
      actionResult = { roomId: data };
    } else if (action === "join") {
      const roomId = String(body.roomId ?? "");
      const code = String(body.code ?? "").trim().toUpperCase().slice(0, 12) || null;
      const { data, error } = roomId
        ? await (current.supabase as any).rpc("casino_pvp_join_v116", { p_room_id: roomId, p_code: code })
        : await (current.supabase as any).rpc("casino_pvp_join_code_v116", { p_code: code });
      if (error) throw new Error(String(error.message));
      actionResult = data;
    } else if (action === "cancel") {
      const roomId = String(body.roomId ?? "");
      const { error } = await (current.supabase as any).rpc("casino_pvp_cancel_v116", { p_room_id: roomId });
      if (error) throw new Error(String(error.message));
    } else {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    const snapshot = await lobby(current.supabase);
    return NextResponse.json({ ...snapshot, actionResult });
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 400 });
  }
}
