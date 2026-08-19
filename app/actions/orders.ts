"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  attachNostraPaymentOrder,
  chargeNostraMotors,
  refundNostraMotors,
} from "@/lib/nostra-motors/game-payment";

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
    value.includes("place_nostra_order_v157") ||
    value.includes("nostra_prepare_cart_delivery_v160") ||
    value.includes("checkout_vehicle_reservation_deposits_v160") ||
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
  if (value.includes("loyalty_tier_required")) return "tier-required";
  if (value.includes("invalid_delivery_mode")) return "delivery";
  if (value.includes("invalid_delivery_address")) return "address";
  if (value.includes("invalid_delivery_phone")) return "phone";
  if (value.includes("hold_expired")) return "hold-expired";
  if (value.includes("vehicle_temporarily_reserved")) return "hold-reserved";
  if (
    value.includes("cart_needs_refresh") ||
    value.includes("invalid_delivery_cart")
  )
    return "cart-refresh";
  return "save";
}

function paymentErrorCode(reason: string): string {
  if (reason === "steam") return "payment-steam";
  if (reason === "receiver" || reason === "receiver_missing") return "payment-receiver";
  if (reason === "funds") return "payment-funds";
  if (reason === "duplicate") return "payment-processing";
  if (reason === "payer") return "payment-player";
  return "payment-bank";
}

async function cartAmountForTypes(
  supabase: any,
  userId: string,
  itemTypes: string[],
): Promise<number> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("unit_price,quantity,item_type")
    .eq("user_id", userId)
    .in("item_type", itemTypes);
  if (error) throw error;
  return Math.max(
    0,
    Math.round(
      (data ?? []).reduce(
        (sum: number, row: any) =>
          sum + Math.max(0, Number(row.unit_price) || 0) * Math.max(1, Number(row.quantity) || 1),
        0,
      ),
    ),
  );
}

async function motorsVehicleCartAmount(
  supabase: any,
  userId: string,
  promoCode: string | null,
): Promise<number> {
  const base = await cartAmountForTypes(supabase, userId, ["vehicle", "delivery"]);
  if (!promoCode || base <= 0) return base;
  const { data, error } = await supabase.rpc("nostra_promo_quote_v153", {
    p_code: promoCode,
    p_scope: "motors",
    p_amount: base,
  });
  if (error) throw error;
  const quote = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (quote.valid !== true) {
    throw new Error(`promo_${String(quote.reason ?? "invalid")}`);
  }
  const discount = Math.max(0, Number(quote.discount_amount) || 0);
  return Math.max(0, Math.round(base - discount));
}

async function chargeCartPayment(args: {
  supabase: any;
  user: any;
  amount: number;
  token: string;
  description: string;
}) {
  if (args.amount <= 0) return null;
  const payment = await chargeNostraMotors({
    supabase: args.supabase,
    user: args.user,
    amount: args.amount,
    idempotencyKey: args.token,
    description: args.description,
  });
  return payment;
}

async function refundIfNeeded(
  payment: Awaited<ReturnType<typeof chargeCartPayment>>,
  reason: string,
) {
  if (!payment || !payment.ok) return;
  await refundNostraMotors({
    payerPid: payment.payerPid,
    receiverPid: payment.receiverPid,
    amount: payment.amount,
    paymentId: payment.paymentId,
    reason,
  });
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
  if (lookup.data.item_type === "vehicle" && lookup.data.vehicle_id) {
    await (supabase as any).rpc("nostra_release_vehicle_hold_v161", {
      p_vehicle_id: Number(lookup.data.vehicle_id),
    });
  }
  revalidateCommerce();
  redirect("/profil?cart_removed=1");
}

export async function placeCartOrder(formData: FormData) {
  const customerNote = text(formData.get("customer_note"), 1500) || null;
  const checkoutToken = text(formData.get("checkout_token"), 120) || `motors-${crypto.randomUUID()}`;
  const rawPromoCode = text(formData.get("promo_code"), 80);
  const promoCode = rawPromoCode ? rawPromoCode.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32) || null : null;
  const deliveryMode = text(formData.get("delivery_mode"), 30) || "showroom";
  const deliveryAddressId = integer(formData.get("delivery_address_id"));
  let deliveryAddress = text(formData.get("delivery_address"), 500);
  let deliveryPhone = text(formData.get("delivery_phone"), 40);
  let deliveryAddressLabel = text(formData.get("delivery_address_label"), 100) || null;
  let deliveryInstructions = text(formData.get("delivery_instructions"), 500) || null;

  if (!["showroom", "home"].includes(deliveryMode)) {
    redirect("/profil?order_error=delivery");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  if (deliveryMode === "home" && deliveryAddressId > 0) {
    const { data: savedAddress } = await (supabase as any)
      .from("nostra_delivery_addresses_v161")
      .select("label,address_line,city,zone,phone,instructions")
      .eq("id", deliveryAddressId)
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (savedAddress) {
      deliveryAddress = [savedAddress.address_line, savedAddress.city, savedAddress.zone]
        .filter(Boolean)
        .join(", ");
      deliveryPhone = String(savedAddress.phone || deliveryPhone || "");
      deliveryAddressLabel = String(savedAddress.label || deliveryAddressLabel || "Adresse enregistrée");
      deliveryInstructions = String(savedAddress.instructions || deliveryInstructions || "") || null;
    }
  }

  if (deliveryMode === "home" && deliveryAddress.length < 5) {
    redirect("/profil?order_error=address");
  }
  if (deliveryMode === "home" && deliveryPhone.length < 3) {
    redirect("/profil?order_error=phone");
  }

  const { error: holdError } = await (supabase as any).rpc("nostra_validate_my_cart_holds_v161");
  if (holdError) redirect(`/profil?order_error=${orderErrorCode(holdError)}`);

  const { error: deliveryError } = await (supabase as any).rpc(
    "nostra_prepare_cart_delivery_v160",
    {
      p_delivery_mode: deliveryMode,
      p_delivery_address: deliveryMode === "home" ? deliveryAddress : null,
      p_delivery_phone: deliveryMode === "home" ? deliveryPhone : null,
    },
  );
  if (deliveryError) {
    redirect(`/profil?order_error=${orderErrorCode(deliveryError)}`);
  }

  // V162 : la préparation V160 recalcule les lignes de livraison ;
  // on réapplique donc les campagnes juste avant le paiement final.
  await (supabase as any).rpc("nostra_apply_active_campaigns_to_my_cart_v162");

  let payableAmount = 0;
  try {
    payableAmount = await motorsVehicleCartAmount(supabase as any, data.user.id, promoCode);
  } catch (error) {
    redirect(`/profil?order_error=${orderErrorCode(error as any)}`);
  }
  if (payableAmount <= 0) redirect("/profil?order_error=empty");

  const payment = await chargeCartPayment({
    supabase: supabase as any,
    user: data.user,
    amount: payableAmount,
    token: `motors-order:${data.user.id}:${checkoutToken}`,
    description: "Commande Nostra Motors",
  });
  if (payment && !payment.ok) {
    redirect(`/profil?order_error=${paymentErrorCode(payment.reason)}`);
  }

  const orderNumber = createOrderNumber();
  const customerName =
    getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors";

  const { data: result, error } = await (supabase as any).rpc("place_nostra_order_v157", {
    p_order_number: orderNumber,
    p_customer_name: customerName,
    p_customer_note: customerNote,
    p_promo_code: promoCode,
  });

  if (error) {
    await refundIfNeeded(payment, `order_rpc:${orderErrorCode(error)}`);
    redirect(`/profil?order_error=${orderErrorCode(error)}`);
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const savedNumber =
    typeof response.order_number === "string"
      ? response.order_number
      : orderNumber;
  const savedOrderId = Number(response.id);

  if (payment?.ok && Number.isFinite(savedOrderId) && savedOrderId > 0) {
    await attachNostraPaymentOrder(payment.paymentId, savedOrderId);
  }

  if (Number.isFinite(savedOrderId) && savedOrderId > 0) {
    await (supabase as any).rpc("nostra_convert_my_holds_v161", {
      p_order_id: savedOrderId,
    });
    if (deliveryMode === "home") {
      await (supabase as any).rpc("nostra_attach_delivery_snapshot_v161", {
        p_order_id: savedOrderId,
        p_address_id: deliveryAddressId > 0 ? deliveryAddressId : null,
        p_label: deliveryAddressLabel,
        p_address: deliveryAddress,
        p_phone: deliveryPhone,
        p_instructions: deliveryInstructions,
      });
    }
  }

  revalidateCommerce();
  revalidatePath("/dashboard/livraisons");
  redirect(`/profil?order_sent=${encodeURIComponent(savedNumber)}`);
}

export async function checkoutVehicleReservationDeposits(formData?: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const amount = await cartAmountForTypes(supabase as any, data.user.id, ["reservation_deposit"]);
  if (amount <= 0) redirect("/profil?reservation_error=empty-reservation");
  const token = formData ? text(formData.get("checkout_token"), 120) : "";
  const payment = await chargeCartPayment({
    supabase: supabase as any,
    user: data.user,
    amount,
    token: `motors-reservation-deposit:${data.user.id}:${token || crypto.randomUUID()}`,
    description: "Acompte de réservation Nostra Motors",
  });
  if (payment && !payment.ok) redirect(`/profil?reservation_error=${paymentErrorCode(payment.reason)}`);

  const customerName =
    getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors";
  const { data: result, error } = await supabase.rpc(
    "checkout_vehicle_reservation_deposits_v160",
    { p_customer_name: customerName },
  );

  if (error) {
    await refundIfNeeded(payment, `reservation_deposit:${orderErrorCode(error)}`);
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

export async function checkoutVehicleReservationBalances(formData?: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const amount = await cartAmountForTypes(supabase as any, data.user.id, ["reservation_balance"]);
  if (amount <= 0) redirect("/profil?balance_error=empty-balance");
  const token = formData ? text(formData.get("checkout_token"), 120) : "";
  const payment = await chargeCartPayment({
    supabase: supabase as any,
    user: data.user,
    amount,
    token: `motors-reservation-balance:${data.user.id}:${token || crypto.randomUUID()}`,
    description: "Solde de réservation Nostra Motors",
  });
  if (payment && !payment.ok) redirect(`/profil?balance_error=${paymentErrorCode(payment.reason)}`);

  const { data: result, error } = await supabase.rpc(
    "checkout_vehicle_reservation_balances_v93",
  );
  if (error) {
    await refundIfNeeded(payment, `reservation_balance:${orderErrorCode(error)}`);
    redirect(`/profil?balance_error=${orderErrorCode(error)}`);
  }

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
