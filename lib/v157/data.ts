import "server-only";

import { createClient } from "@/lib/supabase/server";

export type VehicleAccessTierV157 =
  | "all"
  | "silver"
  | "gold"
  | "black_signature";

export type VehicleMerchandisingV157 = {
  vehicleId: number;
  saleEnabled: boolean;
  saleMode: "percent" | "price";
  saleValue: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  requiredTier: VehicleAccessTierV157;
};

export type ActiveVehicleSaleV157 = {
  vehicleId: number;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
};

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeVehicleAccessTierV157(
  value: unknown,
): VehicleAccessTierV157 {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");

  if (normalized === "silver") return "silver";
  if (normalized === "gold") return "gold";
  if (normalized === "black" || normalized === "black signature") {
    return "black_signature";
  }
  return "all";
}

export function vehicleAccessTierLabelV157(
  tier: VehicleAccessTierV157,
): string {
  if (tier === "silver") return "Silver";
  if (tier === "gold") return "Gold";
  if (tier === "black_signature") return "Black Signature";
  return "Tous les membres";
}

export function vehicleTierBadgeClassV157(
  tier: VehicleAccessTierV157,
): string {
  if (tier === "silver") return "is-silver";
  if (tier === "gold") return "is-gold";
  if (tier === "black_signature") return "is-black";
  return "";
}

export function canCitizenAccessVehicleTierV157(
  requiredTier: VehicleAccessTierV157,
  citizenTier: VehicleAccessTierV157,
): boolean {
  if (requiredTier === "all") return true;
  return requiredTier === citizenTier;
}

export async function getCurrentCitizenVehicleTierV157(
  userId?: string | null,
): Promise<VehicleAccessTierV157> {
  if (!userId) return "all";
  const supabase = await createClient();

  const [profileResult, cardResult] = await Promise.all([
    (supabase as any)
      .from("loyalty_profiles")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle(),
    (supabase as any)
      .from("loyalty_cards")
      .select("tier")
      .eq("user_id", userId)
      .eq("active", true)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return normalizeVehicleAccessTierV157(
    cardResult.data?.tier ?? profileResult.data?.tier,
  );
}

export async function getVehicleMerchandisingMapV157(
  vehicleIds: number[],
): Promise<Map<number, VehicleMerchandisingV157>> {
  const result = new Map<number, VehicleMerchandisingV157>();
  if (!vehicleIds.length) return result;

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_vehicle_merchandising_v157")
    .select(
      "vehicle_id,sale_enabled,sale_mode,sale_value,sale_starts_at,sale_ends_at,required_tier",
    )
    .in("vehicle_id", vehicleIds);

  if (error) return result;

  for (const row of data ?? []) {
    const vehicleId = numberValue(row.vehicle_id);
    if (!vehicleId) continue;
    result.set(vehicleId, {
      vehicleId,
      saleEnabled: row.sale_enabled === true,
      saleMode: row.sale_mode === "price" ? "price" : "percent",
      saleValue: Math.max(0, numberValue(row.sale_value)),
      saleStartsAt:
        typeof row.sale_starts_at === "string" ? row.sale_starts_at : null,
      saleEndsAt:
        typeof row.sale_ends_at === "string" ? row.sale_ends_at : null,
      requiredTier: normalizeVehicleAccessTierV157(row.required_tier),
    });
  }

  return result;
}

export function getActiveVehicleSaleV157(
  merchandising: VehicleMerchandisingV157 | undefined,
  regularPrice: number,
  now = Date.now(),
): ActiveVehicleSaleV157 | null {
  if (!merchandising?.saleEnabled || regularPrice <= 0) return null;

  if (
    merchandising.saleStartsAt &&
    new Date(merchandising.saleStartsAt).getTime() > now
  ) {
    return null;
  }
  if (
    merchandising.saleEndsAt &&
    new Date(merchandising.saleEndsAt).getTime() < now
  ) {
    return null;
  }

  const rawSalePrice =
    merchandising.saleMode === "price"
      ? merchandising.saleValue
      : regularPrice * (1 - merchandising.saleValue / 100);
  const salePrice = Math.max(0, Math.round(rawSalePrice * 100) / 100);

  if (salePrice >= regularPrice) return null;

  return {
    vehicleId: merchandising.vehicleId,
    regularPrice,
    salePrice,
    discountPercent: Math.max(
      1,
      Math.round(((regularPrice - salePrice) / regularPrice) * 100),
    ),
    saleStartsAt: merchandising.saleStartsAt,
    saleEndsAt: merchandising.saleEndsAt,
  };
}

export async function getVehicleMerchandisingV157(vehicleId: number) {
  const map = await getVehicleMerchandisingMapV157([vehicleId]);
  return map.get(vehicleId) ?? {
    vehicleId,
    saleEnabled: false,
    saleMode: "percent" as const,
    saleValue: 0,
    saleStartsAt: null,
    saleEndsAt: null,
    requiredTier: "all" as const,
  };
}
