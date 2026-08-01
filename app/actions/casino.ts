/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 180): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
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
