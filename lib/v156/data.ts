import "server-only";

import { getLoyaltyTiersV155, getPrivateSalesV155 } from "@/lib/v155/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const n = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const s = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

export type RentalInspectionV156 = {
  id: string;
  bookingId: string;
  inspectionType: "departure" | "return";
  mileage: number | null;
  fuelPercent: number | null;
  exteriorCondition: string;
  interiorCondition: string;
  damageNotes: string;
  customerComment: string;
  photos: string[];
  staffName: string | null;
  createdAt: string;
  brand: string;
  model: string;
  rentalNumber: string;
  userId: string;
};

export async function getRentalInspectionsV156(bookingId?: string) {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("motors_rental_inspections_v156")
    .select("*,motors_rental_bookings_v155(rental_number,user_id,catalog_vehicles(brand,model))")
    .order("created_at", { ascending: false });
  if (bookingId) query = query.eq("booking_id", bookingId);
  const { data, error } = await query;
  if (error) return [] as RentalInspectionV156[];
  return (data ?? []).map((row: any) => ({
    id: s(row.id),
    bookingId: s(row.booking_id),
    inspectionType: row.inspection_type === "return" ? "return" : "departure",
    mileage: row.mileage == null ? null : n(row.mileage),
    fuelPercent: row.fuel_percent == null ? null : n(row.fuel_percent),
    exteriorCondition: s(row.exterior_condition),
    interiorCondition: s(row.interior_condition),
    damageNotes: s(row.damage_notes),
    customerComment: s(row.customer_comment),
    photos: Array.isArray(row.photos) ? row.photos.map(String) : [],
    staffName: row.staff_name ? s(row.staff_name) : null,
    createdAt: s(row.created_at),
    brand: s(row.motors_rental_bookings_v155?.catalog_vehicles?.brand),
    model: s(row.motors_rental_bookings_v155?.catalog_vehicles?.model),
    rentalNumber: s(row.motors_rental_bookings_v155?.rental_number),
    userId: s(row.motors_rental_bookings_v155?.user_id),
  }));
}

export type FlashSaleV156 = {
  id: string;
  vehicleId: number;
  title: string;
  flashPrice: number;
  regularPrice: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  activeNow: boolean;
  brand: string;
  model: string;
};

export async function getFlashSalesV156(includeDisabled = false): Promise<FlashSaleV156[]> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("nostra_flash_sales_v156")
    .select("*,catalog_vehicles(id,brand,model,price)")
    .order("created_at", { ascending: false });
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) return [];
  const now = Date.now();
  return (data ?? []).map((row: any) => ({
    id: s(row.id),
    vehicleId: n(row.vehicle_id),
    title: s(row.title, "Vente flash"),
    flashPrice: n(row.flash_price),
    regularPrice: n(row.catalog_vehicles?.price),
    startsAt: s(row.starts_at),
    endsAt: s(row.ends_at),
    enabled: row.enabled !== false,
    activeNow:
      row.enabled !== false &&
      new Date(row.starts_at).getTime() <= now &&
      new Date(row.ends_at).getTime() >= now,
    brand: s(row.catalog_vehicles?.brand),
    model: s(row.catalog_vehicles?.model),
  }));
}

export async function getFlashSaleMapV156(vehicleIds: number[]) {
  const map = new Map<number, FlashSaleV156>();
  if (!vehicleIds.length) return map;
  const rows = await getFlashSalesV156(false);
  for (const row of rows) {
    if (row.activeNow && vehicleIds.includes(row.vehicleId) && !map.has(row.vehicleId)) {
      map.set(row.vehicleId, row);
    }
  }
  return map;
}

export async function getActiveFlashSaleForVehicleV156(vehicleId: number) {
  const map = await getFlashSaleMapV156([vehicleId]);
  return map.get(vehicleId) ?? null;
}

export type MysteryEventV156 = {
  id: string;
  teaserTitle: string;
  teaserText: string;
  revealAt: string;
  revealedTitle: string;
  revealedText: string;
  targetUrl: string | null;
  enabled: boolean;
  revealed: boolean;
};

export async function getMysteryEventsV156(includeDisabled = false): Promise<MysteryEventV156[]> {
  const supabase = await createClient();
  let data: any[] | null = null;
  let error: any = null;
  if (includeDisabled) {
    const result = await (supabase as any)
      .from("nostra_mystery_events_v156")
      .select("*")
      .order("reveal_at", { ascending: true });
    data = result.data;
    error = result.error;
  } else {
    const result = await (supabase as any).rpc("nostra_mystery_events_public_v156");
    data = Array.isArray(result.data) ? result.data : [];
    error = result.error;
  }
  if (error) return [];
  const now = Date.now();
  return (data ?? []).map((row: any) => ({
    id: s(row.id),
    teaserTitle: s(row.teaser_title),
    teaserText: s(row.teaser_text),
    revealAt: s(row.reveal_at),
    revealedTitle: s(row.revealed_title),
    revealedText: s(row.revealed_text),
    targetUrl: row.target_url ? s(row.target_url) : null,
    enabled: row.enabled !== false,
    revealed: new Date(row.reveal_at).getTime() <= now,
  }));
}

export async function getCurrentMysteryEventV156() {
  const rows = await getMysteryEventsV156(false);
  const upcoming = rows.filter((row) => !row.revealed).sort((a, b) => new Date(a.revealAt).getTime() - new Date(b.revealAt).getTime());
  if (upcoming.length) return upcoming[0];
  return [...rows].sort((a, b) => new Date(b.revealAt).getTime() - new Date(a.revealAt).getTime())[0] ?? null;
}

export type GlobalCountdownV156 = {
  enabled: boolean;
  title: string;
  subtitle: string;
  endsAt: string | null;
  targetUrl: string | null;
};

export async function getGlobalCountdownV156(): Promise<GlobalCountdownV156 | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_global_countdown_v156")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (error || !data) return null;
  return {
    enabled: data.enabled === true,
    title: s(data.title),
    subtitle: s(data.subtitle),
    endsAt: data.ends_at ? s(data.ends_at) : null,
    targetUrl: data.target_url ? s(data.target_url) : null,
  };
}

export async function getVipCenterV156(userId: string) {
  const supabase = await createClient();
  const [tiers, privateSales, pointsResult] = await Promise.all([
    getLoyaltyTiersV155(),
    getPrivateSalesV155(userId, false),
    (supabase as any).rpc("nostra_loyalty_points_v155", { p_user_id: userId }),
  ]);
  const points = n(pointsResult.data);
  const activeTiers = tiers.filter((tier) => tier.active).sort((a, b) => a.minPoints - b.minPoints);
  let current = activeTiers[0] ?? null;
  let next = null as (typeof activeTiers)[number] | null;
  for (const tier of activeTiers) {
    if (points >= tier.minPoints) current = tier;
    if (points < tier.minPoints) {
      next = tier;
      break;
    }
  }
  return {
    points,
    current,
    next,
    privateSales: privateSales.filter((sale: any) => sale.eligible),
    lockedPrivateSales: privateSales.filter((sale: any) => !sale.eligible),
  };
}

export type CustomRoleV156 = {
  roleKey: string;
  label: string;
  description: string;
  baseRole: string;
  active: boolean;
};

export type BlacklistEntryV156 = {
  id: string;
  userId: string;
  displayName: string;
  scope: string;
  reason: string;
  blockedUntil: string | null;
  active: boolean;
  createdAt: string;
};

export async function getSecurityExtensionsV156() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const [roles, assignments, permissions, blacklist, emergency, presence] = await Promise.all([
    (supabase as any).from("nostra_custom_roles_v156").select("*").order("label"),
    (supabase as any).from("nostra_member_custom_roles_v156").select("user_id,role_key"),
    (supabase as any).from("nostra_custom_page_permissions_v156").select("path_pattern,allowed_roles"),
    (supabase as any).from("nostra_internal_blacklist_v156").select("*").order("created_at", { ascending: false }),
    (supabase as any).from("nostra_emergency_mode_v156").select("*").eq("singleton", true).maybeSingle(),
    (admin as any).from("nostra_presence_v156").select("user_id,last_seen_at,current_path,user_agent"),
  ]);

  const userIds = [...new Set((blacklist.data ?? []).map((row: any) => s(row.user_id)).filter(Boolean))];
  const profiles = userIds.length
    ? await (supabase as any)
        .from("member_profiles")
        .select("user_id,rp_first_name,rp_last_name,discord_name")
        .in("user_id", userIds)
    : { data: [] };
  const nameMap = new Map<string, string>();
  for (const row of profiles.data ?? []) {
    const name = `${s(row.rp_first_name)} ${s(row.rp_last_name)}`.trim() || s(row.discord_name, "Citoyen");
    nameMap.set(s(row.user_id), name);
  }

  return {
    roles: (roles.data ?? []).map((row: any): CustomRoleV156 => ({
      roleKey: s(row.role_key),
      label: s(row.label),
      description: s(row.description),
      baseRole: s(row.base_role, "employee"),
      active: row.active !== false,
    })),
    assignments: (assignments.data ?? []).map((row: any) => ({ userId: s(row.user_id), roleKey: s(row.role_key) })),
    permissions: (permissions.data ?? []).map((row: any) => ({ pathPattern: s(row.path_pattern), allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles.map(String) : [] })),
    blacklist: (blacklist.data ?? []).map((row: any): BlacklistEntryV156 => ({
      id: s(row.id),
      userId: s(row.user_id),
      displayName: nameMap.get(s(row.user_id)) ?? "Citoyen",
      scope: s(row.scope),
      reason: s(row.reason),
      blockedUntil: row.blocked_until ? s(row.blocked_until) : null,
      active: row.active !== false,
      createdAt: s(row.created_at),
    })),
    emergency: emergency.data
      ? {
          enabled: emergency.data.enabled === true,
          message: s(emergency.data.message),
          blockMotors: emergency.data.block_motors === true,
          blockCircuit: emergency.data.block_circuit === true,
          blockCercle: emergency.data.block_cercle === true,
          blockEvents: emergency.data.block_events === true,
        }
      : null,
    presence: (presence.data ?? []).map((row: any) => ({
      userId: s(row.user_id),
      lastSeenAt: s(row.last_seen_at),
      currentPath: s(row.current_path),
      userAgent: s(row.user_agent),
      online: Date.now() - new Date(row.last_seen_at).getTime() <= 2 * 60 * 1000,
    })),
  };
}
