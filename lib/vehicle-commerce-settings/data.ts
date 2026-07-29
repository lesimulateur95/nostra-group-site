import { createClient } from "@/lib/supabase/server";

export type VehicleCommerceAvailability = {
  vehicle_id: number;
  reservation_enabled: boolean;
  sale_enabled: boolean;
};

export type VehicleCommerceDashboardRow = VehicleCommerceAvailability & {
  brand: string;
  model: string;
  catalog_type: string;
  published: boolean;
  stock_quantity: number;
};

const DEFAULT_AVAILABILITY: VehicleCommerceAvailability = {
  vehicle_id: 0,
  reservation_enabled: true,
  sale_enabled: true,
};

function normalizeAvailability(
  vehicleId: number,
  row?: Record<string, unknown> | null,
): VehicleCommerceAvailability {
  return {
    vehicle_id: vehicleId,
    reservation_enabled: row?.reservation_enabled !== false,
    sale_enabled: row?.sale_enabled !== false,
  };
}

export async function getVehicleCommerceAvailability(
  vehicleId: number,
): Promise<VehicleCommerceAvailability & { configured: boolean }> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,reservation_enabled,sale_enabled")
    .eq("id", vehicleId)
    .maybeSingle();

  if (error || !data) {
    return {
      ...DEFAULT_AVAILABILITY,
      vehicle_id: vehicleId,
      configured: false,
    };
  }

  return {
    ...normalizeAvailability(vehicleId, data as Record<string, unknown>),
    configured: true,
  };
}

export async function getVehicleCommerceAvailabilityMap(
  vehicleIds: number[],
): Promise<Map<number, VehicleCommerceAvailability>> {
  const uniqueIds = [...new Set(vehicleIds.filter((id) => id > 0))];
  const fallback = new Map<number, VehicleCommerceAvailability>(
    uniqueIds.map((id) => [
      id,
      { ...DEFAULT_AVAILABILITY, vehicle_id: id },
    ]),
  );

  if (uniqueIds.length === 0) return fallback;

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,reservation_enabled,sale_enabled")
    .in("id", uniqueIds);

  // Compatibilité tant que le SQL V99 n'est pas encore exécuté.
  if (error) return fallback;

  for (const rawRow of (data ?? []) as Record<string, unknown>[]) {
    const id = Number(rawRow.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    fallback.set(id, normalizeAvailability(id, rawRow));
  }

  return fallback;
}

export async function getVehicleCommerceDashboardState(): Promise<{
  configured: boolean;
  vehicles: VehicleCommerceDashboardRow[];
}> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_vehicles")
    .select(
      "id,brand,model,catalog_type,published,stock_quantity,reservation_enabled,sale_enabled",
    )
    .order("catalog_type", { ascending: true })
    .order("brand", { ascending: true })
    .order("model", { ascending: true });

  if (error) return { configured: false, vehicles: [] };

  const vehicles = ((data ?? []) as Record<string, unknown>[]).flatMap(
    (row): VehicleCommerceDashboardRow[] => {
      const id = Number(row.id);
      if (!Number.isFinite(id) || id <= 0) return [];

      return [
        {
          vehicle_id: id,
          brand: typeof row.brand === "string" ? row.brand : "Véhicule",
          model: typeof row.model === "string" ? row.model : `#${id}`,
          catalog_type:
            typeof row.catalog_type === "string"
              ? row.catalog_type
              : "standard",
          published: row.published === true,
          stock_quantity: Math.max(0, Number(row.stock_quantity) || 0),
          reservation_enabled: row.reservation_enabled !== false,
          sale_enabled: row.sale_enabled !== false,
        },
      ];
    },
  );

  return { configured: true, vehicles };
}
