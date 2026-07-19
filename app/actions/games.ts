"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export type SpinWheelResponse = {
  ok: boolean;
  error?: "setup" | "save" | "auth" | "daily_limit";
  spin?: {
    id: number;
    slot_index: number;
    prize_key: string;
    prize_label: string;
    prize_type: "bonus" | "loss";
    redemption_status: "unused" | "used" | "lost";
  };
};

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: FormDataEntryValue | null, max = 50): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function errorText(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined): string {
  return `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
}

function isDailyLimitError(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined): boolean {
  const value = errorText(error);
  return value.includes("daily_spin_limit") || value.includes("game_wheel_spins_one_per_day_idx");
}

function isSetupError(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined): boolean {
  const value = errorText(error);
  return value.includes("pgrst202") || value.includes("pgrst205") || value.includes("42p01") || value.includes("spin_nostra_wheel") || value.includes("game_wheel_spins");
}

export async function spinWheel(): Promise<SpinWheelResponse> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "auth" };

  const { data: result, error } = await supabase.rpc("spin_nostra_wheel");
  if (error) {
    if (isDailyLimitError(error)) return { ok: false, error: "daily_limit" };
    return { ok: false, error: isSetupError(error) ? "setup" : "save" };
  }
  if (!result || typeof result !== "object") return { ok: false, error: "save" };

  const candidate = result as Record<string, unknown>;
  const slotIndex = Number(candidate.slot_index);
  const id = Number(candidate.id);
  const prizeType = candidate.prize_type === "loss" ? "loss" : "bonus";
  const redemptionStatus = candidate.redemption_status === "used" ? "used" : candidate.redemption_status === "lost" ? "lost" : "unused";
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 22 || !Number.isFinite(id)) {
    return { ok: false, error: "save" };
  }

  revalidatePath("/evenements/roue-de-la-chance");
  revalidatePath("/profil");
  revalidatePath("/profil/jeux");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/roue");

  return {
    ok: true,
    spin: {
      id,
      slot_index: slotIndex,
      prize_key: String(candidate.prize_key ?? ""),
      prize_label: String(candidate.prize_label ?? "Gain"),
      prize_type: prizeType,
      redemption_status: redemptionStatus,
    },
  };
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

export async function updateWheelGainStatus(formData: FormData) {
  const id = integer(formData.get("id"));
  const status = text(formData.get("status"), 20);
  if (id <= 0 || !new Set(["unused", "used"]).has(status)) {
    redirect("/dashboard/jeux/roue?error=invalid");
  }

  const { supabase, user } = await requireManager();
  const { data: spin, error: readError } = await supabase
    .from("game_wheel_spins")
    .select("id,prize_type")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError || !spin || spin.prize_type === "loss") redirect("/dashboard/jeux/roue?error=invalid");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("game_wheel_spins")
    .update({
      redemption_status: status,
      used_at: status === "used" ? now : null,
      used_by: status === "used" ? user.id : null,
      updated_at: now,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) redirect(`/dashboard/jeux/roue?error=${isSetupError(error) ? "setup" : "save"}`);
  revalidatePath("/dashboard/jeux/roue");
  revalidatePath("/profil/jeux");
  redirect("/dashboard/jeux/roue?saved=1");
}


export async function deleteWheelGain(formData: FormData) {
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/dashboard/jeux/roue?error=invalid");

  const { supabase, user } = await requireManager();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("game_wheel_spins")
    .update({ deleted_at: now, used_by: user.id, updated_at: now })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) redirect(`/dashboard/jeux/roue?error=${isSetupError(error) ? "setup" : "delete"}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/roue");
  revalidatePath("/profil/jeux");
  redirect("/dashboard/jeux/roue?deleted=1");
}
