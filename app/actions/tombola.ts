"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 120): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimal(value: FormDataEntryValue | null): number {
  const normalized = typeof value === "string" ? value.replace(",", ".").trim() : "";
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : -1;
}

function errorCode(error: { message?: string | null; code?: string | null } | null | undefined): string {
  const value = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (value.includes("invalid_name")) return "name";
  if (value.includes("round_closed")) return "closed";
  if (value.includes("empty_cart")) return "empty";
  if (value.includes("draw_already_done")) return "drawn";
  if (value.includes("no_tickets")) return "tickets";
  if (value.includes("too_many_winners")) return "winners";
  if (value.includes("ticket_pool_exhausted")) return "pool";
  if (value.includes("tombola_") || value.includes("42p01") || value.includes("pgrst")) return "setup";
  return "save";
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

function revalidateTombola() {
  revalidatePath("/evenements/tombola");
  revalidatePath("/evenements/tombola/inscription");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/tombola");
  revalidatePath("/profil");
  revalidatePath("/profil/jeux");
}

export async function addTombolaToCart(formData: FormData) {
  const firstName = text(formData.get("first_name"), 40);
  const lastName = text(formData.get("last_name"), 40);
  const quantity = integer(formData.get("quantity"));

  if (firstName.length < 2 || lastName.length < 2 || quantity < 1 || quantity > 100) {
    redirect("/evenements/tombola/inscription?error=invalid");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { error } = await supabase.rpc("add_tombola_to_cart", {
    p_customer_name: `${firstName} ${lastName}`,
    p_quantity: quantity,
  });

  if (error) redirect(`/evenements/tombola/inscription?error=${errorCode(error)}`);

  revalidateTombola();
  redirect("/profil?tombola_added=1");
}

export async function removeTombolaCart() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { error } = await supabase
    .from("tombola_cart_items")
    .delete()
    .eq("user_id", data.user.id);

  if (error) redirect("/profil?tombola_cart_error=1");
  revalidateTombola();
  redirect("/profil?tombola_removed=1");
}

export async function checkoutTombolaCart() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: result, error } = await supabase.rpc("checkout_tombola_cart");
  if (error) redirect(`/profil?tombola_order_error=${errorCode(error)}`);

  const orderNumber = result && typeof result === "object" && "order_number" in result
    ? String(result.order_number)
    : "Tombola";

  revalidateTombola();
  redirect(`/profil/jeux?tombola_order=${encodeURIComponent(orderNumber)}`);
}

export async function updateTombolaSettings(formData: FormData) {
  const title = text(formData.get("title"), 120);
  const ticketPrice = decimal(formData.get("ticket_price"));
  const status = text(formData.get("status"), 20);

  if (!title || ticketPrice < 0 || !new Set(["open", "closed"]).has(status)) {
    redirect("/dashboard/jeux/tombola?error=invalid");
  }

  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("update_tombola_settings", {
    p_title: title,
    p_ticket_price: ticketPrice,
    p_status: status,
  });

  if (error) redirect(`/dashboard/jeux/tombola?error=${errorCode(error)}`);
  revalidateTombola();
  redirect("/dashboard/jeux/tombola?saved=1");
}

export async function drawTombola(formData: FormData) {
  const winnerCount = integer(formData.get("winner_count"));
  if (winnerCount < 1 || winnerCount > 20) {
    redirect("/dashboard/jeux/tombola?error=invalid");
  }

  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("draw_tombola", {
    p_winner_count: winnerCount,
  });

  if (error) redirect(`/dashboard/jeux/tombola?error=${errorCode(error)}`);
  revalidateTombola();
  redirect("/dashboard/jeux/tombola?drawn=1");
}

export async function resetTombola(formData: FormData) {
  const confirmation = text(formData.get("confirmation"), 40);
  if (confirmation !== "RESET_TOMBOLA") {
    redirect("/dashboard/jeux/tombola?error=invalid");
  }

  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("reset_tombola");

  if (error) redirect(`/dashboard/jeux/tombola?error=${errorCode(error)}`);
  revalidateTombola();
  redirect("/dashboard/jeux/tombola?reset=1");
}
