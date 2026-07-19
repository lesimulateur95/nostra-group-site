"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingOrderSetup(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "PGRST204" || error.code === "PGRST205" || error.code === "42703" || message.includes("items") || message.includes("customer_name");
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

function createOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase();
  return `NM-${date}-${token}`;
}

export async function placeCartOrder(formData: FormData) {
  const customerNote = text(formData.get("customer_note"), 1500) || null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: cart, error: cartError } = await supabase
    .from("cart_items")
    .select("id,item_name,quantity,unit_price,image_url")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: true });

  if (cartError) redirect("/profil?order_error=cart");
  if (!cart?.length) redirect("/profil?order_error=empty");

  const items = cart.map((item) => ({
    name: String(item.item_name),
    quantity: Math.max(1, Number(item.quantity) || 1),
    unit_price: Math.max(0, Number(item.unit_price) || 0),
    image_url: typeof item.image_url === "string" ? item.image_url : null,
  }));
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const orderNumber = createOrderNumber();
  const customerName = getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors";

  const { data: createdOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: data.user.id,
      order_number: orderNumber,
      customer_name: customerName,
      status: "pending",
      total,
      items,
      customer_note: customerNote,
      updated_at: new Date().toISOString(),
    })
    .select("id,order_number")
    .single();

  if (isMissingOrderSetup(orderError)) redirect("/profil?order_error=setup");
  if (orderError || !createdOrder) redirect("/profil?order_error=save");

  const { error: clearError } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", data.user.id);

  if (clearError) {
    await supabase.from("orders").delete().eq("id", createdOrder.id).eq("user_id", data.user.id);
    redirect("/profil?order_error=cart-clear");
  }

  revalidatePath("/profil");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  redirect(`/profil?order_sent=${encodeURIComponent(createdOrder.order_number)}`);
}

export async function updateOrder(formData: FormData) {
  const id = integer(formData.get("id"));
  const status = text(formData.get("status"), 30);
  const adminNote = text(formData.get("admin_note"), 2000) || null;
  const allowed = new Set(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]);
  if (id <= 0 || !allowed.has(status)) redirect("/dashboard/commandes?error=invalid");

  const { supabase } = await requireManager();
  const { error } = await supabase
    .from("orders")
    .update({ status, admin_note: adminNote, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) redirect("/dashboard/commandes?error=save");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/profil");
  redirect("/dashboard/commandes?saved=1");
}

export async function deleteOrder(formData: FormData) {
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/dashboard/commandes?error=invalid");

  const { supabase } = await requireManager();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) redirect("/dashboard/commandes?error=delete");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/profil");
  redirect("/dashboard/commandes?deleted=1");
}
