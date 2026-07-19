"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export type BingoDrawResponse = {
  ok: boolean;
  error?: "setup" | "auth" | "manager" | "complete" | "empty" | "save";
  ballNumber?: number;
  drawOrder?: number;
  winners?: Array<{ card_number: number; customer_name: string; phase: string }>;
};

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
  if (value.includes("invalid_name") || value.includes("invalid_quantity")) return "invalid";
  if (value.includes("round_closed")) return "closed";
  if (value.includes("empty_cart")) return "empty";
  if (value.includes("full_card_complete")) return "complete";
  if (value.includes("no_numbers_left")) return "empty";
  if (value.includes("manager_required")) return "manager";
  if (value.includes("bingo_") || value.includes("42p01") || value.includes("pgrst")) return "setup";
  return "save";
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

function revalidateBingo() {
  revalidatePath("/evenements/bingo");
  revalidatePath("/evenements/bingo/inscription");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/bingo");
  revalidatePath("/profil");
  revalidatePath("/profil/jeux");
}

export async function addBingoToCart(formData: FormData) {
  const firstName = text(formData.get("first_name"), 40);
  const lastName = text(formData.get("last_name"), 40);
  const quantity = integer(formData.get("quantity"));

  if (firstName.length < 2 || lastName.length < 2 || quantity < 1 || quantity > 20) {
    redirect("/evenements/bingo/inscription?error=invalid");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { error } = await supabase.rpc("add_bingo_to_cart", {
    p_customer_name: `${firstName} ${lastName}`,
    p_quantity: quantity,
  });

  if (error) redirect(`/evenements/bingo/inscription?error=${errorCode(error)}`);
  revalidateBingo();
  redirect("/profil?bingo_added=1");
}

export async function removeBingoCart() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { error } = await supabase.from("bingo_cart_items").delete().eq("user_id", data.user.id);
  if (error) redirect("/profil?bingo_cart_error=1");
  revalidateBingo();
  redirect("/profil?bingo_removed=1");
}

export async function checkoutBingoCart() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: result, error } = await supabase.rpc("checkout_bingo_cart");
  if (error) redirect(`/profil?bingo_order_error=${errorCode(error)}`);

  const orderNumber = result && typeof result === "object" && "order_number" in result
    ? String(result.order_number)
    : "Bingo";

  revalidateBingo();
  redirect(`/profil/jeux?bingo_order=${encodeURIComponent(orderNumber)}`);
}

export async function updateBingoSettings(formData: FormData) {
  const title = text(formData.get("title"), 120);
  const cardPrice = decimal(formData.get("card_price"));
  const status = text(formData.get("status"), 20);

  if (!title || cardPrice < 0 || !new Set(["open", "closed"]).has(status)) {
    redirect("/dashboard/jeux/bingo?error=invalid");
  }

  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("update_bingo_settings", {
    p_title: title,
    p_card_price: cardPrice,
    p_status: status,
  });

  if (error) redirect(`/dashboard/jeux/bingo?error=${errorCode(error)}`);
  revalidateBingo();
  redirect("/dashboard/jeux/bingo?saved=1");
}

export async function setBingoPhase(formData: FormData) {
  const phase = text(formData.get("phase"), 24);
  if (!new Set(["one_line", "two_lines", "three_lines", "four_lines", "full_card"]).has(phase)) {
    redirect("/dashboard/jeux/bingo?error=invalid");
  }

  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("set_bingo_phase", { p_phase: phase });
  if (error) redirect(`/dashboard/jeux/bingo?error=${errorCode(error)}`);
  revalidateBingo();
  redirect("/dashboard/jeux/bingo?phase=1");
}

export async function drawBingoNumber(): Promise<BingoDrawResponse> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "auth" };
  if (!(await hasDashboardAccess(data.user))) return { ok: false, error: "manager" };

  const { data: result, error } = await supabase.rpc("draw_bingo_number");
  if (error) {
    const code = errorCode(error);
    return {
      ok: false,
      error: code === "setup" ? "setup" : code === "complete" ? "complete" : code === "empty" ? "empty" : code === "manager" ? "manager" : "save",
    };
  }

  const payload = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const winnersRaw = Array.isArray(payload.new_winners) ? payload.new_winners : [];
  const winners = winnersRaw.flatMap((winner) => {
    if (!winner || typeof winner !== "object") return [];
    const item = winner as Record<string, unknown>;
    return [{
      card_number: Number(item.card_number) || 0,
      customer_name: String(item.customer_name ?? "Citoyen"),
      phase: String(item.phase ?? "one_line"),
    }];
  });

  revalidateBingo();
  return {
    ok: true,
    ballNumber: Number(payload.ball_number) || undefined,
    drawOrder: Number(payload.draw_order) || undefined,
    winners,
  };
}

export async function clearBingoDraws(formData: FormData) {
  const confirmation = text(formData.get("confirmation"), 40);
  if (confirmation !== "CLEAR_BINGO_NUMBERS") redirect("/dashboard/jeux/bingo?error=invalid");

  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("clear_bingo_draws");
  if (error) redirect(`/dashboard/jeux/bingo?error=${errorCode(error)}`);
  revalidateBingo();
  redirect("/dashboard/jeux/bingo?cleared=1");
}

export async function resetBingo(formData: FormData) {
  const confirmation = text(formData.get("confirmation"), 40);
  if (confirmation !== "RESET_BINGO") redirect("/dashboard/jeux/bingo?error=invalid");

  const { supabase } = await requireManager();
  const { error } = await supabase.rpc("reset_bingo_round");
  if (error) redirect(`/dashboard/jeux/bingo?error=${errorCode(error)}`);
  revalidateBingo();
  redirect("/dashboard/jeux/bingo?reset=1");
}
