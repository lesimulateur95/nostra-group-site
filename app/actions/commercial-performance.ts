"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const PATH = "/dashboard/commerciaux";

function text(value: FormDataEntryValue | null, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amount(value: FormDataEntryValue | null): number {
  const parsed = Number(text(value, 40).replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return { supabase, user: data.user };
}

function refresh() {
  revalidatePath(PATH);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/dashboard/comptabilite");
}

export async function saveCommissionSettingsV137(formData: FormData) {
  const mode = text(formData.get("commission_mode"), 20);
  const value = amount(formData.get("commission_value"));
  if (!["percent", "fixed"].includes(mode) || (mode === "percent" && value > 100)) {
    redirect(`${PATH}?error=invalid`);
  }

  const { supabase, user } = await requireManager();
  const { error } = await supabase.from("commercial_commission_settings_v137").upsert({
    id: 1,
    enabled: formData.get("enabled") === "true",
    commission_mode: mode,
    commission_value: value,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) redirect(`${PATH}?error=save`);
  refresh();
  redirect(`${PATH}?settings=1`);
}

export async function saveCommercialObjectiveV137(formData: FormData) {
  const commercialUserId = text(formData.get("commercial_user_id"), 80);
  const monthValue = text(formData.get("objective_month"), 10);
  const salesTarget = Math.floor(amount(formData.get("sales_target")));
  const revenueTarget = amount(formData.get("revenue_target"));
  const targetBonus = amount(formData.get("target_bonus"));
  const month = /^\d{4}-\d{2}$/.test(monthValue) ? `${monthValue}-01` : "";
  if (!commercialUserId || !month) redirect(`${PATH}?error=invalid`);

  const { supabase, user } = await requireManager();
  const { data: profile } = await supabase
    .from("member_profiles")
    .select("discord_name,email,rp_first_name,rp_last_name")
    .eq("user_id", commercialUserId)
    .maybeSingle();
  const rpName = [profile?.rp_first_name, profile?.rp_last_name].filter(Boolean).join(" ").trim();
  const commercialName = rpName || String(profile?.discord_name || profile?.email || "");
  if (!commercialName) redirect(`${PATH}?error=invalid`);
  const { error } = await supabase.from("commercial_objectives_v137").upsert(
    {
      commercial_user_id: commercialUserId,
      commercial_name: commercialName,
      objective_month: month,
      sales_target: salesTarget,
      revenue_target: revenueTarget,
      target_bonus: targetBonus,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "commercial_user_id,objective_month" },
  );
  if (error) redirect(`${PATH}?error=save`);
  refresh();
  redirect(`${PATH}?objective=1`);
}

export async function payCommercialMonthV137(formData: FormData) {
  const commercialUserId = text(formData.get("commercial_user_id"), 80);
  const month = text(formData.get("payment_month"), 10);
  if (!commercialUserId || !/^\d{4}-\d{2}-01$/.test(month)) redirect(`${PATH}?error=invalid`);
  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("pay_commercial_month_v137", {
    p_commercial_user_id: commercialUserId,
    p_month: month,
  });
  if (error) {
    const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
    const code = value.includes("already_paid") ? "paid" : value.includes("nothing_to_pay") ? "empty" : "save";
    redirect(`${PATH}?error=${code}`);
  }
  refresh();
  redirect(`${PATH}?payment=1`);
}
