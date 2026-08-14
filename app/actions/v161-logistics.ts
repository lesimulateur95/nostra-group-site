/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 1000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
function bool(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "true" || value === "on";
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  return { supabase, user: data.user };
}

async function requireStaff() {
  const { supabase, user } = await requireUser();
  const roles = await getUserRoleKeys(user);
  if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) {
    redirect("/accueil");
  }
  return { supabase, user };
}

function deliveryErrorCode(error: any): string {
  const value = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  if (value.includes("fleet_capacity_insufficient")) return "capacity";
  if (value.includes("fleet_conflict")) return "conflict";
  if (value.includes("fleet_required")) return "fleet";
  if (value.includes("invalid_delivery_date")) return "date";
  if (value.includes("invalid_delivery_stage")) return "stage";
  if (value.includes("invalid_fleet")) return "fleet-invalid";
  if (value.includes("invalid_settings")) return "settings";
  return "save";
}

export async function saveDeliveryAddressV161(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = integer(formData.get("id"));
  const label = text(formData.get("label"), 80);
  const addressLine = text(formData.get("address_line"), 300);
  const city = text(formData.get("city"), 100) || null;
  const zone = text(formData.get("zone"), 100) || null;
  const phone = text(formData.get("phone"), 40) || null;
  const instructions = text(formData.get("instructions"), 500) || null;
  const requestedDefault = bool(formData.get("is_default"));

  if (label.length < 2 || addressLine.length < 5) {
    redirect("/profil/adresses?error=invalid");
  }

  const { count } = await (supabase as any)
    .from("nostra_delivery_addresses_v161")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const makeDefault = requestedDefault || Number(count ?? 0) === 0;

  if (makeDefault) {
    await (supabase as any)
      .from("nostra_delivery_addresses_v161")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  const payload = {
    user_id: user.id,
    label,
    address_line: addressLine,
    city,
    zone,
    phone,
    instructions,
    is_default: makeDefault,
    updated_at: new Date().toISOString(),
  };

  const query = id > 0
    ? (supabase as any)
        .from("nostra_delivery_addresses_v161")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
    : (supabase as any).from("nostra_delivery_addresses_v161").insert(payload);
  const { error } = await query;
  if (error) redirect("/profil/adresses?error=save");

  revalidatePath("/profil");
  revalidatePath("/profil/adresses");
  revalidatePath("/motors/catalogue");
  redirect("/profil/adresses?saved=1");
}

export async function setDefaultDeliveryAddressV161(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/profil/adresses?error=invalid");

  await (supabase as any)
    .from("nostra_delivery_addresses_v161")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  const { error } = await (supabase as any)
    .from("nostra_delivery_addresses_v161")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) redirect("/profil/adresses?error=save");
  revalidatePath("/profil/adresses");
  redirect("/profil/adresses?default=1");
}

export async function deleteDeliveryAddressV161(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = integer(formData.get("id"));
  if (id <= 0) redirect("/profil/adresses?error=invalid");

  const { data: row } = await (supabase as any)
    .from("nostra_delivery_addresses_v161")
    .select("is_default")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const wasDefault = Boolean(row?.is_default);

  const { error } = await (supabase as any)
    .from("nostra_delivery_addresses_v161")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) redirect("/profil/adresses?error=delete");

  if (wasDefault) {
    const { data: next } = await (supabase as any)
      .from("nostra_delivery_addresses_v161")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      await (supabase as any)
        .from("nostra_delivery_addresses_v161")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", next.id)
        .eq("user_id", user.id);
    }
  }

  revalidatePath("/profil/adresses");
  redirect("/profil/adresses?deleted=1");
}


export async function releaseTemporaryHoldAdminV161(formData: FormData) {
  const { supabase } = await requireStaff();
  const holdId = integer(formData.get("hold_id"));
  if (holdId <= 0) redirect("/dashboard/livraisons?error=invalid#holds");
  const { error } = await (supabase as any).rpc("nostra_admin_release_hold_v161", {
    p_hold_id: holdId,
  });
  if (error) redirect("/dashboard/livraisons?error=save#holds");
  revalidatePath("/dashboard/livraisons");
  revalidatePath("/motors/catalogue");
  revalidatePath("/profil");
  redirect("/dashboard/livraisons?hold_released=1#holds");
}

export async function updateDeliveryPlanV161(formData: FormData) {
  const { supabase } = await requireStaff();
  const orderId = integer(formData.get("order_id"));
  const stage = text(formData.get("delivery_stage"), 40);
  const startRaw = text(formData.get("delivery_start"), 80);
  const endRaw = text(formData.get("delivery_end"), 80);
  const driver = text(formData.get("delivery_driver"), 120) || null;
  const notes = text(formData.get("delivery_notes"), 800) || null;
  const fleetIds = formData
    .getAll("fleet_ids")
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (orderId <= 0) redirect("/dashboard/livraisons?error=invalid");
  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
    redirect("/dashboard/livraisons?error=date");
  }

  const { error } = await (supabase as any).rpc("nostra_update_delivery_plan_v161", {
    p_order_id: orderId,
    p_stage: stage,
    p_start: start ? start.toISOString() : null,
    p_end: end ? end.toISOString() : null,
    p_driver: driver,
    p_notes: notes,
    p_fleet_ids: fleetIds,
  });
  if (error) redirect(`/dashboard/livraisons?error=${deliveryErrorCode(error)}&open=${orderId}`);

  revalidatePath("/dashboard/livraisons");
  revalidatePath("/dashboard");
  revalidatePath("/profil/commandes");
  redirect(`/dashboard/livraisons?saved=1&open=${orderId}`);
}

export async function updateDeliveryChecklistV161(formData: FormData) {
  const { supabase } = await requireStaff();
  const orderId = integer(formData.get("order_id"));
  const vehicleId = integer(formData.get("vehicle_id"));
  const prepared = integer(formData.get("prepared_quantity"));
  const loaded = integer(formData.get("loaded_quantity"));
  if (orderId <= 0 || vehicleId <= 0) redirect("/dashboard/livraisons?error=invalid");

  const { error } = await (supabase as any).rpc("nostra_update_delivery_checklist_v161", {
    p_order_id: orderId,
    p_vehicle_id: vehicleId,
    p_prepared: prepared,
    p_loaded: loaded,
  });
  if (error) redirect(`/dashboard/livraisons?error=save&open=${orderId}`);
  revalidatePath("/dashboard/livraisons");
  redirect(`/dashboard/livraisons?checklist=1&open=${orderId}`);
}

export async function saveDeliveryFleetV161(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = integer(formData.get("id"));
  const name = text(formData.get("name"), 120);
  const type = text(formData.get("fleet_type"), 30) || "custom";
  const capacity = integer(formData.get("capacity"));
  const enabled = bool(formData.get("enabled"));
  const status = text(formData.get("status"), 30) || "available";
  const displayOrder = integer(formData.get("display_order"));

  const { error } = await (supabase as any).rpc("nostra_upsert_delivery_fleet_v161", {
    p_id: id > 0 ? id : null,
    p_name: name,
    p_type: type,
    p_capacity: capacity,
    p_enabled: enabled,
    p_status: status,
    p_display_order: displayOrder,
  });
  if (error) redirect(`/dashboard/livraisons?error=${deliveryErrorCode(error)}#flotte`);
  revalidatePath("/dashboard/livraisons");
  redirect("/dashboard/livraisons?fleet_saved=1#flotte");
}

export async function updateLogisticsSettingsV161(formData: FormData) {
  const { supabase } = await requireStaff();
  const holdMinutes = integer(formData.get("hold_minutes"));
  const maxHoldVehicles = integer(formData.get("max_hold_vehicles"));
  const slotMinutes = integer(formData.get("default_slot_minutes"));
  const { error } = await (supabase as any).rpc("nostra_update_logistics_settings_v161", {
    p_hold_minutes: holdMinutes,
    p_max_hold_vehicles: maxHoldVehicles,
    p_default_slot_minutes: slotMinutes,
  });
  if (error) redirect(`/dashboard/livraisons?error=${deliveryErrorCode(error)}#settings`);
  revalidatePath("/dashboard/livraisons");
  redirect("/dashboard/livraisons?settings_saved=1#settings");
}
