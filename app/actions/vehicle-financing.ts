/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getCitizenBankInformation } from "@/lib/game-bank/data";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorCode(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  const value = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (value.includes("pgrst202") || value.includes("v125")) return "setup";
  if (value.includes("financing_not_pending")) return "status";
  if (value.includes("financing_not_payable")) return "payment-status";
  if (value.includes("financing_payment_missing")) return "payment-missing";
  if (value.includes("insufficient_stock")) return "stock";
  if (value.includes("vehicle_unavailable")) return "vehicle";
  return "save";
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return { supabase, user: data.user };
}

function revalidateFinancing() {
  revalidatePath("/profil");
  revalidatePath("/profil/financements");
  revalidatePath("/profil/commandes");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/financements-vehicules");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/poids-lourds");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  revalidatePath("/motors/catalogue/vehicules-occasion");
}

export async function updateVehicleFinancingSettings(formData: FormData) {
  const enabled = text(formData.get("enabled"), 10) === "true";
  const threeTimesEnabled =
    text(formData.get("three_times_enabled"), 10) === "true";
  const fourTimesEnabled =
    text(formData.get("four_times_enabled"), 10) === "true";
  const threeTimesFeePercent = Number(
    text(formData.get("three_times_fee_percent"), 20),
  );
  const fourTimesFeePercent = Number(
    text(formData.get("four_times_fee_percent"), 20),
  );
  const installmentIntervalDays = integer(
    formData.get("installment_interval_days"),
  );

  if (
    !Number.isFinite(threeTimesFeePercent) ||
    !Number.isFinite(fourTimesFeePercent) ||
    threeTimesFeePercent < 0 ||
    fourTimesFeePercent < 0 ||
    threeTimesFeePercent > 50 ||
    fourTimesFeePercent > 50 ||
    installmentIntervalDays < 1 ||
    installmentIntervalDays > 365
  ) {
    redirect("/dashboard/financements-vehicules?error=settings");
  }

  const { supabase } = await requireManager();
  const { error } = await (supabase as any).rpc(
    "update_vehicle_financing_settings_v125",
    {
      p_enabled: enabled,
      p_three_times_enabled: threeTimesEnabled,
      p_four_times_enabled: fourTimesEnabled,
      p_three_times_fee_percent: threeTimesFeePercent,
      p_four_times_fee_percent: fourTimesFeePercent,
      p_installment_interval_days: installmentIntervalDays,
    },
  );

  if (error) {
    redirect(
      `/dashboard/financements-vehicules?error=${errorCode(error)}`,
    );
  }
  revalidateFinancing();
  redirect("/dashboard/financements-vehicules?saved=1");
}

export async function reviewVehicleFinancingApplication(formData: FormData) {
  const applicationId = integer(formData.get("application_id"));
  const decision = text(formData.get("decision"), 20);
  const reviewNote = text(formData.get("review_note"), 2000) || null;
  if (
    applicationId <= 0 ||
    !["approve", "reject"].includes(decision) ||
    (decision === "reject" && !reviewNote)
  ) {
    redirect("/dashboard/financements-vehicules?error=invalid");
  }

  const { supabase } = await requireManager();
  const { data: application, error: lookupError } = await (supabase as any)
    .from("vehicle_financing_applications")
    .select("id,steam_id,status")
    .eq("id", applicationId)
    .maybeSingle();
  if (lookupError || !application) {
    redirect("/dashboard/financements-vehicules?error=missing");
  }

  const banking = await getCitizenBankInformation(
    typeof application.steam_id === "string" ? application.steam_id : null,
  );
  const { error } = await (supabase as any).rpc(
    "review_vehicle_financing_v125",
    {
      p_application_id: applicationId,
      p_decision: decision,
      p_review_note: reviewNote,
      p_bank_balance:
        banking.status === "connected"
          ? banking.accounts.reduce(
              (sum, account) => sum + account.balance,
              0,
            )
          : null,
      p_bank_checked_at:
        banking.status === "connected" ? banking.checkedAt : null,
    },
  );
  if (error) {
    redirect(
      `/dashboard/financements-vehicules?error=${errorCode(error)}`,
    );
  }

  revalidateFinancing();
  redirect(
    `/dashboard/financements-vehicules?${
      decision === "approve" ? "approved" : "rejected"
    }=1`,
  );
}

export async function checkoutVehicleFinancingPayment(formData: FormData) {
  const applicationId = integer(formData.get("application_id"));
  if (applicationId <= 0) redirect("/profil/financements?error=invalid");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: result, error } = await (supabase as any).rpc(
    "checkout_vehicle_financing_payment_v125",
    { p_application_id: applicationId },
  );
  if (error) {
    redirect(`/profil/financements?error=${errorCode(error)}`);
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  revalidateFinancing();
  redirect(
    `/profil/financements?paid=${encodeURIComponent(
      String(response.payment_type ?? "payment"),
    )}`,
  );
}
