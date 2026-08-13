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

function errorText(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  return `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
}

function isMissingStockOrderSetup(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  const value = errorText(error);
  return (
    value.includes("pgrst202") ||
    value.includes("place_nostra_order_v93") ||
    value.includes("checkout_vehicle_reservation") ||
    value.includes("review_vehicle_reservation_v93") ||
    value.includes("vehicle_reservations") ||
    value.includes("reservation_id") ||
    value.includes("update_nostra_order") ||
    value.includes("delete_nostra_order") ||
    value.includes("stock_deducted")
  );
}

function orderErrorCode(
  error: { code?: string | null; message?: string | null } | null | undefined,
): string {
  const value = errorText(error);
  if (isMissingStockOrderSetup(error)) return "setup";
  if (value.includes("empty_cart")) return "empty";
  if (value.includes("empty_reservation_cart")) return "empty-reservation";
  if (value.includes("empty_balance_cart")) return "empty-balance";
  if (value.includes("reservation_already_exists")) return "reservation-exists";
  if (value.includes("reservation_balance_unavailable")) return "balance-unavailable";
  if (value.includes("insufficient_stock")) return "stock";
  if (value.includes("vehicle_unavailable")) return "unavailable";
  if (value.includes("promo_unknown")) return "promo-unknown";
  if (value.includes("promo_disabled")) return "promo-disabled";
  if (value.includes("promo_expired") || value.includes("promo_not_started")) return "promo-date";
  if (value.includes("promo_scope")) return "promo-scope";
  if (value.includes("promo_minimum")) return "promo-minimum";
  if (value.includes("promo_limit") || value.includes("promo_user_limit")) return "promo-limit";
  if (
    value.includes("cart_needs_refresh") ||
    value.includes("invalid_delivery_cart")
  )
    return "cart-refresh";
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
  return { supabase, user: data.user, roles };
}

function createOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase();
  return `NM-${date}-${token}`;
}

function revalidateCommerce() {
  revalidatePath("/profil");
  revalidatePath("/profil/commandes");
  revalidatePath("/profil/reservations-vehicules");
  revalidatePath("/profil/documents");
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/poids-lourds");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  revalidatePath("/motors/catalogue/vehicules-occasion");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/dashboard/reservations-vehicules");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/occasion/commandes");
  revalidatePath("/dashboard/occasion/stocks");
  revalidatePath("/dashboard/occasion/ventes");
  revalidatePath("/dashboard/occasion/documents");
  revalidatePath("/dashboard/occasion/statistiques");
}

export async function removeCartItem(formData: FormData) {
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/profil?cart_error=invalid");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const lookup = await supabase
    .from("cart_items")
    .select("id,item_type,vehicle_id,related_vehicle_id,locked")
    .eq("id", id)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (lookup.error || !lookup.data) redirect("/profil?cart_error=delete");
  if (lookup.data.locked || lookup.data.item_type === "reservation_balance") {
    redirect("/profil?cart_error=locked");
  }

  if (lookup.data.item_type === "vehicle" && lookup.data.vehicle_id) {
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
  revalidateCommerce();
  redirect("/profil?cart_removed=1");
}

export async function placeCartOrder(formData: FormData) {
  const customerNote = text(formData.get("customer_note"), 1500) || null;
  const rawPromoCode = text(formData.get("promo_code"), 80);
  const promoCode = rawPromoCode ? rawPromoCode.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32) || null : null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const orderNumber = createOrderNumber();
  const customerName =
    getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors";

  const { data: result, error } = await (supabase as any).rpc("place_nostra_order_v153", {
    p_order_number: orderNumber,
    p_customer_name: customerName,
    p_customer_note: customerNote,
    p_promo_code: promoCode,
  });

  if (error) redirect(`/profil?order_error=${orderErrorCode(error)}`);

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const savedNumber =
    typeof response.order_number === "string"
      ? response.order_number
      : orderNumber;

  revalidateCommerce();
  redirect(`/profil?order_sent=${encodeURIComponent(savedNumber)}`);
}

export async function checkoutVehicleReservationDeposits() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const customerName =
    getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors";
  const { data: result, error } = await supabase.rpc(
    "checkout_vehicle_reservation_deposits_v93",
    { p_customer_name: customerName },
  );

  if (error) {
    redirect(`/profil?reservation_error=${orderErrorCode(error)}`);
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const count = Math.max(1, Number(response.reservations_created) || 1);
  revalidateCommerce();
  redirect(`/profil?reservation_paid=${count}`);
}

export async function checkoutVehicleReservationBalances() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: result, error } = await supabase.rpc(
    "checkout_vehicle_reservation_balances_v93",
  );
  if (error) redirect(`/profil?balance_error=${orderErrorCode(error)}`);

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const count = Math.max(1, Number(response.orders_created) || 1);
  revalidateCommerce();
  redirect(`/profil?balance_paid=${count}`);
}

export async function reviewVehicleReservation(formData: FormData) {
  const id = integer(formData.get("id"));
  const decision = text(formData.get("decision"), 30);
  const adminNote = text(formData.get("admin_note"), 2000) || null;
  if (id <= 0 || !["approve", "reject"].includes(decision)) {
    redirect("/dashboard/reservations-vehicules?error=invalid");
  }

  const { supabase } = await requireMotorsStaff();
  const { error } = await supabase.rpc("review_vehicle_reservation_v93", {
    p_reservation_id: id,
    p_decision: decision,
    p_admin_note: adminNote,
  });
  if (error) {
    redirect(
      `/dashboard/reservations-vehicules?error=${orderErrorCode(error)}`,
    );
  }

  revalidateCommerce();
  redirect(
    `/dashboard/reservations-vehicules?${
      decision === "approve" ? "approved" : "rejected"
    }=1`,
  );
}

export async function updateOrder(formData: FormData) {
  const id = integer(formData.get("id"));
  const status = text(formData.get("status"), 30);
  const adminNote = text(formData.get("admin_note"), 2000) || null;
  const allowed = new Set([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ]);
  if (id <= 0 || !allowed.has(status)) {
    redirect("/dashboard/commandes?error=invalid");
  }

  const { supabase, roles } = await requireMotorsStaff();
  const { error } = await supabase.rpc("update_nostra_order", {
    p_order_id: id,
    p_status: status,
    p_admin_note: adminNote,
  });

  if (error) {
    const code = orderErrorCode(error);
    redirect(
      `/dashboard/commandes?error=${
        code === "stock" ? "stock" : code === "setup" ? "setup" : "save"
      }`,
    );
  }

  if (roles.includes("manager")) {
    const commercialUserId = text(formData.get("commercial_user_id"), 80) || null;
    const assignment = await supabase.rpc("assign_order_commercial_v137", {
      p_order_id: id,
      p_commercial_user_id: commercialUserId,
    });
    if (assignment.error) {
      redirect("/dashboard/commandes?error=assignment");
    }
  }
  revalidateCommerce();
  revalidatePath("/dashboard/commerciaux");
  redirect("/dashboard/commandes?saved=1");
}

export async function deleteOrder(formData: FormData) {
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/dashboard/commandes?error=invalid");

  const { supabase } = await requireMotorsStaff();
  const { error } = await supabase.rpc("delete_nostra_order", {
    p_order_id: id,
  });
  if (error) {
    redirect(
      `/dashboard/commandes?error=${
        isMissingStockOrderSetup(error) ? "setup" : "delete"
      }`,
    );
  }

  revalidateCommerce();
  redirect("/dashboard/commandes?deleted=1");
}
