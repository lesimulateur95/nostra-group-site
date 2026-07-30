"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function amount(value: FormDataEntryValue | null): number {
  const parsed = Number(text(value, 80).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : -1;
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return supabase;
}

function contractError(error: { message?: string | null; code?: string | null }) {
  const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (value.includes("empty_contract_cart")) return "empty";
  if (value.includes("responsible_not_found")) return "responsible";
  if (value.includes("invalid_contract")) return "invalid";
  if (value.includes("invalid_price")) return "price";
  if (value.includes("forbidden")) return "forbidden";
  if (value.includes("pgrst202") || value.includes("circuit_contract")) return "setup";
  return "save";
}

function revalidateContracts() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/contrats");
  revalidatePath("/profil");
}

export async function createCircuitContract(formData: FormData) {
  const organizationName = text(formData.get("organization_name"), 180);
  const responsibleUserId = text(formData.get("responsible_user_id"), 80);
  const monthlyPrice = amount(formData.get("monthly_price"));
  const startedOn = text(formData.get("started_on"), 20);
  const endsOn = text(formData.get("ends_on"), 20) || null;

  if (!organizationName || !responsibleUserId || monthlyPrice < 0 || !startedOn) {
    redirect("/dashboard/contrats?error=invalid");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "create_circuit_contract_v114",
    {
      p_organization_name: organizationName,
      p_responsible_user_id: responsibleUserId,
      p_monthly_price: monthlyPrice,
      p_billing_day: Math.max(1, Math.min(integer(formData.get("billing_day")) || 1, 28)),
      p_payment_due_days: Math.max(
        0,
        Math.min(integer(formData.get("payment_due_days")) || 10, 31),
      ),
      p_started_on: startedOn,
      p_ends_on: endsOn,
      p_access_scope:
        text(formData.get("access_scope"), 2000) ||
        "Accès mensuel au circuit pour les entraînements",
      p_authorized_people: integer(formData.get("authorized_people")) || null,
      p_notes: text(formData.get("notes"), 5000) || null,
    },
  );

  if (error) redirect(`/dashboard/contrats?error=${contractError(error)}`);
  revalidateContracts();
  redirect("/dashboard/contrats?created=1");
}

export async function updateCircuitContractPrice(formData: FormData) {
  const contractId = integer(formData.get("contract_id"));
  const newPrice = amount(formData.get("new_price"));
  const effectiveFrom = text(formData.get("effective_from"), 20);
  if (contractId <= 0 || newPrice < 0 || !effectiveFrom) {
    redirect("/dashboard/contrats?error=price");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "update_circuit_contract_price_v114",
    {
      p_contract_id: contractId,
      p_new_price: newPrice,
      p_effective_from: effectiveFrom,
      p_reason: text(formData.get("reason"), 1000) || null,
    },
  );

  if (error) redirect(`/dashboard/contrats?error=${contractError(error)}`);
  revalidateContracts();
  redirect("/dashboard/contrats?price_saved=1");
}

export async function updateCircuitContractStatus(formData: FormData) {
  const contractId = integer(formData.get("contract_id"));
  const status = text(formData.get("status"), 30);
  if (
    contractId <= 0 ||
    !["draft", "active", "suspended", "terminated", "expired"].includes(status)
  ) {
    redirect("/dashboard/contrats?error=invalid");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "update_circuit_contract_status_v114",
    { p_contract_id: contractId, p_status: status },
  );

  if (error) redirect(`/dashboard/contrats?error=${contractError(error)}`);
  revalidateContracts();
  redirect("/dashboard/contrats?status_saved=1");
}

export async function generateContractRenewals() {
  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "generate_due_contract_renewals_v114",
    { p_user_id: null },
  );

  if (error) redirect(`/dashboard/contrats?error=${contractError(error)}`);
  revalidateContracts();
  redirect("/dashboard/contrats?generated=1");
}

export async function cancelContractInstallment(formData: FormData) {
  const installmentId = integer(formData.get("installment_id"));
  if (installmentId <= 0) redirect("/dashboard/contrats?error=invalid");

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "cancel_contract_installment_v114",
    { p_installment_id: installmentId },
  );

  if (error) redirect(`/dashboard/contrats?error=${contractError(error)}`);
  revalidateContracts();
  redirect("/dashboard/contrats?installment_cancelled=1");
}

export async function checkoutContractRenewals() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: result, error } = await (supabase as any).rpc(
    "checkout_contract_renewals_v114",
  );

  if (error) redirect(`/profil?contract_error=${contractError(error)}`);

  const count =
    result && typeof result === "object" && "count" in result
      ? Math.max(1, Number((result as Record<string, unknown>).count) || 1)
      : 1;

  revalidateContracts();
  redirect(`/profil?contract_paid=${count}`);
}
