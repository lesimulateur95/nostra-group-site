"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return supabase;
}

function errorCode(error: { message?: string | null; code?: string | null }) {
  const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (value.includes("missing_citizen_name")) return "name";
  if (value.includes("invalid_tier")) return "tier";
  if (value.includes("forbidden")) return "forbidden";
  if (value.includes("pgrst202") || value.includes("loyalty_cards")) return "setup";
  return "save";
}

function revalidateLoyalty() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/fidelite");
  revalidatePath("/profil");
}

export async function generateLoyaltyCard(formData: FormData) {
  const userId = text(formData.get("user_id"), 80);
  const tier = text(formData.get("tier"), 40);
  if (!userId || !tier) redirect("/dashboard/fidelite?error=invalid");

  const supabase = await requireManager();
  const { data, error } = await (supabase as any).rpc(
    "generate_loyalty_card_v114",
    { p_user_id: userId, p_tier: tier },
  );

  if (error) redirect(`/dashboard/fidelite?error=${errorCode(error)}`);

  const cardNumber =
    data && typeof data === "object" && "card_number" in data
      ? String((data as Record<string, unknown>).card_number)
      : "1";

  revalidateLoyalty();
  redirect(`/dashboard/fidelite?generated=${encodeURIComponent(cardNumber)}`);
}

export async function deactivateLoyaltyCard(formData: FormData) {
  const cardId = integer(formData.get("card_id"));
  if (cardId <= 0) redirect("/dashboard/fidelite?error=invalid");

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "deactivate_loyalty_card_v114",
    { p_card_id: cardId },
  );

  if (error) redirect(`/dashboard/fidelite?error=${errorCode(error)}`);
  revalidateLoyalty();
  redirect("/dashboard/fidelite?deactivated=1");
}

export async function updateLoyaltyCardTemplate(formData: FormData) {
  const tier = text(formData.get("tier"), 40);
  const imageUrl = text(formData.get("image_url"), 2000);
  if (!tier) redirect("/dashboard/fidelite?error=tier");

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "set_loyalty_card_template_v114",
    { p_tier: tier, p_image_url: imageUrl },
  );

  if (error) redirect(`/dashboard/fidelite?error=${errorCode(error)}`);
  revalidateLoyalty();
  redirect("/dashboard/fidelite?template_saved=1");
}
