"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorText(error: { code?: string | null; message?: string | null } | null | undefined): string {
  return `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
}

function isMissingStockOrderSetup(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  const value = errorText(error);
  return value.includes("pgrst202") || value.includes("place_nostra_order") || value.includes("update_nostra_order") || value.includes("delete_nostra_order") || value.includes("stock_deducted");
}

function orderErrorCode(error: { code?: string | null; message?: string | null } | null | undefined): string {
  const value = errorText(error);
  if (isMissingStockOrderSetup(error)) return "setup";
  if (value.includes("empty_cart")) return "empty";
  if (value.includes("insufficient_stock")) return "stock";
  if (value.includes("vehicle_unavailable")) return "unavailable";
  if (value.includes("cart_needs_refresh") || value.includes("invalid_delivery_cart")) return "cart-refresh";
  return "save";
}

async function requireMotorsStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  const allowed = roles.some((role) =>
    ["manager", "employee", "commercial"].includes(role),
  );
  if (!allowed) redirect("/accueil");
  return { supabase, user: data.user };
}

function createOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase();
  return `NM-${date}-${token}`;
}

export async function removeCartItem(formData: FormData) {
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/profil?cart_error=invalid");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const lookup = await supabase
    .from("cart_items")
    .select("id,item_type,vehicle_id,related_vehicle_id")
    .eq("id", id)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!lookup.error && lookup.data?.item_type === "vehicle" && lookup.data.vehicle_id) {
    await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", data.user.id)
      .eq("item_type", "delivery")
      .eq("related_vehicle_id", lookup.data.vehicle_id);
  }

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", id)
    .eq("user_id", data.user.id);

  if (error) redirect("/profil?cart_error=delete");
  revalidatePath("/profil");
  redirect("/profil?cart_removed=1");
}

export async function placeCartOrder(formData: FormData) {
  const customerNote = text(formData.get("customer_note"), 1500) || null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const orderNumber = createOrderNumber();
  const customerName = getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors";

  const { data: result, error } = await supabase.rpc("place_nostra_order", {
    p_order_number: orderNumber,
    p_customer_name: customerName,
    p_customer_note: customerNote,
  });

  if (error) redirect(`/profil?order_error=${orderErrorCode(error)}`);

  const response = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const savedNumber = typeof response.order_number === "string" ? response.order_number : orderNumber;

  revalidatePath("/profil");
  revalidatePath("/profil/commandes");
  revalidatePath("/profil/documents");
  revalidatePath("/motors/catalogue");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/catalogue");
  redirect(`/profil?order_sent=${encodeURIComponent(savedNumber)}`);
}

export async function updateOrder(formData: FormData) {
  const id = integer(formData.get("id"));
  const status = text(formData.get("status"), 30);
  const adminNote = text(formData.get("admin_note"), 2000) || null;
  const allowed = new Set(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]);
  if (id <= 0 || !allowed.has(status)) redirect("/dashboard/commandes?error=invalid");

  const { supabase } = await requireMotorsStaff();
  const { error } = await supabase.rpc("update_nostra_order", {
    p_order_id: id,
    p_status: status,
    p_admin_note: adminNote,
  });

  if (error) {
    const code = orderErrorCode(error);
    redirect(`/dashboard/commandes?error=${code === "stock" ? "stock" : code === "setup" ? "setup" : "save"}`);
  }
  revalidatePath("/motors/catalogue");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/profil");
  revalidatePath("/profil/commandes");
  revalidatePath("/profil/documents");
  redirect("/dashboard/commandes?saved=1");
}

export async function deleteOrder(formData: FormData) {
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/dashboard/commandes?error=invalid");

  const { supabase } = await requireMotorsStaff();
  const { error } = await supabase.rpc("delete_nostra_order", { p_order_id: id });
  if (error) redirect(`/dashboard/commandes?error=${isMissingStockOrderSetup(error) ? "setup" : "delete"}`);

  revalidatePath("/motors/catalogue");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/profil");
  revalidatePath("/profil/commandes");
  revalidatePath("/profil/documents");
  redirect("/dashboard/commandes?deleted=1");
}
