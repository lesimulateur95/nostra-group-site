/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { CASINO_GAMES } from "@/lib/casino/types";

function text(value: FormDataEntryValue | null, max = 180): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
function decimal(value: FormDataEntryValue | null): number {
  const parsed = Number(text(value, 40).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
async function manager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return supabase;
}
function refresh() {
  revalidatePath("/accueil");
  revalidatePath("/casino", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/casino");
}

export async function saveCasinoSettings(formData: FormData) {
  const supabase = await manager();
  const publicEnabled = text(formData.get("public_enabled"), 10) === "true";
  const name = text(formData.get("name"), 80);
  const subtitle = text(formData.get("subtitle"), 120);
  const rpPerChip = integer(formData.get("rp_per_chip"));
  const minConversion = integer(formData.get("min_conversion"));
  const maxConversion = integer(formData.get("max_conversion"));
  if (!name || rpPerChip < 1 || minConversion < 1 || maxConversion < minConversion) redirect("/dashboard/jeux/casino?error=settings");
  const { error } = await (supabase as any).rpc("casino_update_settings_v108", {
    p_public_enabled: publicEnabled,
    p_name: name,
    p_subtitle: subtitle,
    p_rp_per_chip: rpPerChip,
    p_min_conversion: minConversion,
    p_max_conversion: maxConversion,
  });
  if (error) redirect("/dashboard/jeux/casino?error=setup");
  refresh();
  redirect(`/dashboard/jeux/casino?saved=${publicEnabled ? "visible" : "hidden"}`);
}

export async function saveCasinoGameSettings(formData: FormData) {
  const supabase = await manager();
  const game = text(formData.get("game"), 30);
  const enabled = text(formData.get("enabled"), 10) === "true";
  const difficulty = text(formData.get("difficulty"), 20);
  const winRate = decimal(formData.get("win_rate_percent"));
  const minBet = integer(formData.get("min_bet"));
  const maxBet = integer(formData.get("max_bet"));
  const baseMultiplier = decimal(formData.get("base_multiplier"));
  const jackpotMultiplier = decimal(formData.get("jackpot_multiplier"));
  const maxPayout = integer(formData.get("max_payout"));
  if (
    !CASINO_GAMES.includes(game as (typeof CASINO_GAMES)[number]) ||
    !["balanced", "hard", "expert", "custom"].includes(difficulty) ||
    winRate < 1 || winRate > 95 || minBet < 1 || maxBet < minBet ||
    baseMultiplier < 0.1 || jackpotMultiplier < baseMultiplier || maxPayout < 1
  ) redirect("/dashboard/jeux/casino?error=game-settings");

  const { error } = await (supabase as any).rpc("casino_update_game_settings_v110", {
    p_game: game,
    p_enabled: enabled,
    p_difficulty: difficulty,
    p_win_rate_percent: winRate,
    p_min_bet: minBet,
    p_max_bet: maxBet,
    p_base_multiplier: baseMultiplier,
    p_jackpot_multiplier: jackpotMultiplier,
    p_max_payout: maxPayout,
  });
  if (error) redirect("/dashboard/jeux/casino?error=game-settings");
  refresh();
  redirect(`/dashboard/jeux/casino?saved=game-${game}`);
}

export async function reviewCasinoConversion(formData: FormData) {
  const supabase = await manager();
  const requestId = text(formData.get("request_id"), 80);
  const decision = text(formData.get("decision"), 20);
  if (!requestId || !["approved", "rejected"].includes(decision)) redirect("/dashboard/jeux/casino?error=conversion");
  const { error } = await (supabase as any).rpc("casino_review_conversion_v108", { p_request_id: requestId, p_decision: decision });
  if (error) redirect("/dashboard/jeux/casino?error=conversion");
  refresh();
  redirect(`/dashboard/jeux/casino?saved=${decision}`);
}

export async function adjustCasinoWallet(formData: FormData) {
  const supabase = await manager();
  const userId = text(formData.get("user_id"), 80);
  const amount = integer(formData.get("amount"));
  const reason = text(formData.get("reason"), 180);
  if (!userId || amount === 0 || !reason) redirect("/dashboard/jeux/casino?error=wallet");
  const { error } = await (supabase as any).rpc("casino_adjust_wallet_v108", { p_user_id: userId, p_amount: amount, p_reason: reason });
  if (error) redirect("/dashboard/jeux/casino?error=wallet");
  refresh();
  redirect("/dashboard/jeux/casino?saved=wallet");
}

export async function resetCasinoPlayer(formData: FormData) {
  const supabase = await manager();
  const userId = text(formData.get("user_id"), 80);
  const scope = text(formData.get("scope"), 30);
  const confirmation = text(formData.get("confirmation"), 80);
  const confirmations: Record<string, string> = {
    balance: "REMETTRE LE SOLDE A ZERO",
    level: "REMETTRE LE NIVEAU A ZERO",
    total: "REINITIALISER LE JOUEUR",
  };
  if (!userId || !confirmations[scope] || confirmation !== confirmations[scope]) {
    redirect("/dashboard/jeux/casino?error=reset");
  }

  const { error } = await (supabase as any).rpc(
    "casino_admin_reset_player_v109",
    {
      p_user_id: userId,
      p_scope: scope,
      p_reason: `Réinitialisation ${scope} depuis le Dashboard`,
    },
  );
  if (error) redirect("/dashboard/jeux/casino?error=reset");
  refresh();
  redirect(`/dashboard/jeux/casino?saved=reset-${scope}`);
}

export async function resetCasinoBeforeOpening(formData: FormData) {
  // La RPC utilise directement la session Supabase du Gérant. Le bouton ne
  // dépend donc plus d'une clé service_role configurée séparément sur Vercel.
  const supabase = await manager();
  const confirmation = text(formData.get("confirmation"), 100);

  if (confirmation !== "OUVRIR LE CASINO A ZERO") {
    redirect("/dashboard/jeux/casino?error=opening-reset-confirmation");
  }

  let result: unknown = null;
  let resetFailed = false;

  try {
    const { data, error } = await (supabase as any).rpc(
      "casino_admin_opening_reset_v114",
      { p_confirmation: confirmation },
    );
    result = data;
    resetFailed = Boolean(error);
  } catch {
    resetFailed = true;
  }

  if (
    resetFailed ||
    !result ||
    typeof result !== "object" ||
    (result as { complete?: unknown }).complete !== true
  ) {
    redirect("/dashboard/jeux/casino?error=opening-reset-v114");
  }
  refresh();
  redirect("/dashboard/jeux/casino?saved=opening-reset-complete");
}
