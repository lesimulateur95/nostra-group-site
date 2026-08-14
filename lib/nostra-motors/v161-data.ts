/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/lib/supabase/server";

export type DeliveryAddressV161 = {
  id: number;
  label: string;
  address_line: string;
  city: string | null;
  zone: string | null;
  phone: string | null;
  instructions: string | null;
  is_default: boolean;
};

export type VehicleHoldSummaryV161 = {
  configured: boolean;
  count: number;
  expiresAt: string | null;
  holdMinutes: number;
};


export type ActiveVehicleHoldAdminV161 = {
  id: number;
  user_id: string;
  vehicle_id: number;
  vehicle_name: string;
  quantity: number;
  expires_at: string;
  customer_name: string;
};

export type DeliveryFleetV161 = {
  id: number;
  name: string;
  fleet_type: "plateau" | "semi" | "carrier" | "custom";
  capacity: number;
  enabled: boolean;
  status: "available" | "maintenance" | "inactive";
  display_order: number;
};

export type DeliveryAssignmentV161 = {
  id: number;
  order_id: number;
  fleet_id: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

export type DeliveryChecklistLineV161 = {
  id: number;
  order_id: number;
  vehicle_id: number;
  vehicle_name: string;
  quantity: number;
  prepared_quantity: number;
  loaded_quantity: number;
};

export type LogisticsSettingsV161 = {
  holdMinutes: number;
  maxHoldVehicles: number;
  defaultSlotMinutes: number;
};

export async function getMyDeliveryAddressesV161(
  userId: string,
): Promise<DeliveryAddressV161[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_delivery_addresses_v161")
    .select("id,label,address_line,city,zone,phone,instructions,is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    label: String(row.label ?? "Adresse"),
    address_line: String(row.address_line ?? ""),
    city: row.city ? String(row.city) : null,
    zone: row.zone ? String(row.zone) : null,
    phone: row.phone ? String(row.phone) : null,
    instructions: row.instructions ? String(row.instructions) : null,
    is_default: Boolean(row.is_default),
  }));
}

export async function getMyVehicleHoldSummaryV161(
  userId: string,
): Promise<VehicleHoldSummaryV161> {
  const supabase = await createClient();
  const cleanup = await (supabase as any).rpc("nostra_cleanup_expired_holds_v161");
  if (cleanup.error) {
    return { configured: false, count: 0, expiresAt: null, holdMinutes: 20 };
  }

  const [{ data, error }, settings] = await Promise.all([
    (supabase as any)
      .from("nostra_vehicle_holds_v161")
      .select("quantity,expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString()),
    getLogisticsSettingsV161(),
  ]);

  if (error) {
    return {
      configured: false,
      count: 0,
      expiresAt: null,
      holdMinutes: settings.holdMinutes,
    };
  }

  const rows = data ?? [];
  const expiresAt = rows
    .map((row: any) => String(row.expires_at ?? ""))
    .filter(Boolean)
    .sort()[0] ?? null;

  return {
    configured: true,
    count: rows.reduce(
      (sum: number, row: any) => sum + Math.max(1, Number(row.quantity) || 1),
      0,
    ),
    expiresAt,
    holdMinutes: settings.holdMinutes,
  };
}

export async function getVehicleHoldCountsV161(
  vehicleIds: number[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (vehicleIds.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc(
    "nostra_vehicle_hold_counts_v161",
    { p_vehicle_ids: vehicleIds },
  );
  if (error || !Array.isArray(data)) return result;

  for (const row of data) {
    const id = Number(row.vehicle_id);
    if (Number.isFinite(id) && id > 0) {
      result.set(id, Math.max(0, Number(row.reserved_quantity) || 0));
    }
  }
  return result;
}

export async function getLogisticsSettingsV161(): Promise<LogisticsSettingsV161> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_logistics_settings_v161")
    .select("hold_minutes,max_hold_vehicles,default_slot_minutes")
    .eq("singleton", true)
    .maybeSingle();
  if (error || !data) {
    return { holdMinutes: 20, maxHoldVehicles: 10, defaultSlotMinutes: 60 };
  }
  return {
    holdMinutes: Math.max(5, Number(data.hold_minutes) || 20),
    maxHoldVehicles: Math.max(1, Number(data.max_hold_vehicles) || 10),
    defaultSlotMinutes: Math.max(15, Number(data.default_slot_minutes) || 60),
  };
}


export async function getActiveVehicleHoldsAdminV161(): Promise<ActiveVehicleHoldAdminV161[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc("nostra_active_vehicle_holds_admin_v161");
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({
    id: Number(row.id),
    user_id: String(row.user_id ?? ""),
    vehicle_id: Number(row.vehicle_id),
    vehicle_name: String(row.vehicle_name ?? "Véhicule"),
    quantity: Math.max(1, Number(row.quantity) || 1),
    expires_at: String(row.expires_at ?? ""),
    customer_name: String(row.customer_name ?? "Citoyen Nostra"),
  }));
}

export async function getDeliveryFleetV161(): Promise<DeliveryFleetV161[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_delivery_fleet_v161")
    .select("id,name,fleet_type,capacity,enabled,status,display_order")
    .order("display_order", { ascending: true })
    .order("capacity", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    name: String(row.name ?? "Transporteur"),
    fleet_type: String(row.fleet_type ?? "custom") as DeliveryFleetV161["fleet_type"],
    capacity: Math.max(1, Number(row.capacity) || 1),
    enabled: Boolean(row.enabled),
    status: String(row.status ?? "available") as DeliveryFleetV161["status"],
    display_order: Number(row.display_order) || 0,
  }));
}

export async function getDeliveryAssignmentsV161(
  orderIds: number[],
): Promise<DeliveryAssignmentV161[]> {
  if (orderIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_delivery_assignments_v161")
    .select("id,order_id,fleet_id,scheduled_start,scheduled_end,status")
    .in("order_id", orderIds)
    .order("scheduled_start", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    order_id: Number(row.order_id),
    fleet_id: Number(row.fleet_id),
    scheduled_start: String(row.scheduled_start),
    scheduled_end: String(row.scheduled_end),
    status: String(row.status ?? "planned"),
  }));
}

export async function getDeliveryChecklistV161(
  orderIds: number[],
): Promise<DeliveryChecklistLineV161[]> {
  if (orderIds.length === 0) return [];
  const supabase = await createClient();
  for (const orderId of orderIds) {
    await (supabase as any).rpc("nostra_sync_delivery_checklist_v161", {
      p_order_id: orderId,
    });
  }
  const { data, error } = await (supabase as any)
    .from("nostra_delivery_checklist_v161")
    .select(
      "id,order_id,vehicle_id,vehicle_name,quantity,prepared_quantity,loaded_quantity",
    )
    .in("order_id", orderIds)
    .order("id", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    order_id: Number(row.order_id),
    vehicle_id: Number(row.vehicle_id),
    vehicle_name: String(row.vehicle_name ?? "Véhicule"),
    quantity: Math.max(1, Number(row.quantity) || 1),
    prepared_quantity: Math.max(0, Number(row.prepared_quantity) || 0),
    loaded_quantity: Math.max(0, Number(row.loaded_quantity) || 0),
  }));
}

export function recommendFleetV161(
  fleet: DeliveryFleetV161[],
  vehicleCount: number,
): DeliveryFleetV161[] {
  const candidates = fleet
    .filter((item) => item.enabled && item.status === "available")
    .sort((a, b) => b.capacity - a.capacity || a.display_order - b.display_order);
  const target = Math.max(0, Math.floor(vehicleCount));
  if (target === 0 || candidates.length === 0) return [];

  // Petite recherche exhaustive : minimise d'abord le nombre de transporteurs,
  // puis la capacité vide. La flotte Nostra reste petite, ce calcul est instantané.
  let best: DeliveryFleetV161[] | null = null;
  const maxDepth = Math.min(candidates.length, 8);
  const visit = (index: number, chosen: DeliveryFleetV161[], capacity: number) => {
    if (capacity >= target) {
      if (
        !best ||
        chosen.length < best.length ||
        (chosen.length === best.length &&
          capacity - target <
            best.reduce((sum, item) => sum + item.capacity, 0) - target)
      ) {
        best = [...chosen];
      }
      return;
    }
    if (index >= candidates.length || chosen.length >= maxDepth) return;
    if (best && chosen.length >= best.length) return;

    visit(index + 1, [...chosen, candidates[index]], capacity + candidates[index].capacity);
    visit(index + 1, chosen, capacity);
  };
  visit(0, [], 0);
  return best ?? [];
}
