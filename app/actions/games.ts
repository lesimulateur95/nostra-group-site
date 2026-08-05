"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export type SpinWheelResponse = {
  ok: boolean;
  error?: "setup" | "save" | "auth" | "daily_limit" | "disabled";
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

function isWheelDisabledError(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined): boolean {
  return errorText(error).includes("wheel_disabled");
}

function isSetupError(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined): boolean {
  const value = errorText(error);
  return value.includes("pgrst202") || value.includes("pgrst205") || value.includes("42p01") || value.includes("spin_nostra_wheel") || value.includes("save_nostra_wheel_configuration") || value.includes("game_wheel_spins") || value.includes("game_wheel_settings") || value.includes("game_wheel_segments");
}

export async function spinWheel(): Promise<SpinWheelResponse> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "auth" };

  const { data: result, error } = await supabase.rpc("spin_nostra_wheel");
  if (error) {
    if (isDailyLimitError(error)) return { ok: false, error: "daily_limit" };
    if (isWheelDisabledError(error)) return { ok: false, error: "disabled" };
    return { ok: false, error: isSetupError(error) ? "setup" : "save" };
  }
  if (!result || typeof result !== "object") return { ok: false, error: "save" };

  const candidate = result as Record<string, unknown>;
  const slotIndex = Number(candidate.slot_index);
  const id = Number(candidate.id);
  const prizeType = candidate.prize_type === "loss" ? "loss" : "bonus";
  const redemptionStatus = candidate.redemption_status === "used" ? "used" : candidate.redemption_status === "lost" ? "lost" : "unused";
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 39 || !Number.isFinite(id)) {
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

type WheelSegmentInput = {
  label: string;
  shortLabel: string;
  type: "bonus" | "loss";
  color: string;
  textColor: string;
};

function parseWheelSegments(value: FormDataEntryValue | null): WheelSegmentInput[] | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 40) return null;

    const colorPattern = /^#[0-9a-f]{6}$/i;
    const segments = parsed.map((entry) => {
      if (!entry || typeof entry !== "object") throw new Error("invalid_segment");
      const source = entry as Record<string, unknown>;
      const label = typeof source.label === "string" ? source.label.trim().slice(0, 100) : "";
      const shortLabel = typeof source.shortLabel === "string" ? source.shortLabel.trim().slice(0, 18) : "";
      const type = source.type === "loss" ? "loss" : source.type === "bonus" ? "bonus" : null;
      const color = typeof source.color === "string" && colorPattern.test(source.color) ? source.color : "";
      const textColor = typeof source.textColor === "string" && colorPattern.test(source.textColor) ? source.textColor : "";
      if (!label || !shortLabel || !type || !color || !textColor) throw new Error("invalid_segment");
      return { label, shortLabel, type, color, textColor } as WheelSegmentInput;
    });

    return segments;
  } catch {
    return null;
  }
}

export async function saveWheelConfiguration(formData: FormData) {
  const enabled = formData.get("enabled") === "on";
  const disabledMessage = text(formData.get("disabled_message"), 500);
  const segments = parseWheelSegments(formData.get("segments"));
  if (!disabledMessage || !segments) redirect("/dashboard/jeux/roue?error=configuration");

  const { supabase } = await requireManager();
  const payload = segments.map((segment, index) => ({
    slot_index: index,
    prize_key: segment.type === "loss" ? `loss_${index}` : `custom_${index}`,
    label: segment.label,
    short_label: segment.shortLabel,
    prize_type: segment.type,
    color: segment.color,
    text_color: segment.textColor,
  }));

  const { error } = await supabase.rpc("save_nostra_wheel_configuration", {
    p_enabled: enabled,
    p_disabled_message: disabledMessage,
    p_segments: payload,
  });
  if (error) redirect(`/dashboard/jeux/roue?error=${isSetupError(error) ? "setup" : "configuration"}`);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/roue");
  revalidatePath("/evenements/roue-de-la-chance");
  redirect("/dashboard/jeux/roue?configuration_saved=1");
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
  const confirmation = text(formData.get("delete_confirmation"), 40);

  // La suppression ne peut partir que depuis le bouton de confirmation du Dashboard.
  // Un tirage de roue, une actualisation ou un autre formulaire ne possède jamais ce code.
  if (id <= 0 || confirmation !== "SUPPRIMER_CE_GAIN") {
    redirect("/dashboard/jeux/roue?error=invalid");
  }

  const { supabase, user } = await requireManager();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("game_wheel_spins")
    .update({
      deleted_at: now,
      used_by: user.id,
      updated_at: now,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    redirect(`/dashboard/jeux/roue?error=${isSetupError(error) ? "setup" : "delete"}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/roue");
  revalidatePath("/profil");
  revalidatePath("/profil/jeux");
  redirect("/dashboard/jeux/roue?deleted=1");
}
