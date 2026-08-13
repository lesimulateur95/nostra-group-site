import { createClient } from "@/lib/supabase/server";

export const VEHICLE_RESERVATION_CATALOG_TYPES = [
  "standard",
  "concession",
  "exclusive",
  "heavy",
  "used",
] as const;

export type VehicleReservationCatalogType =
  (typeof VEHICLE_RESERVATION_CATALOG_TYPES)[number];

export type VehicleReservationCatalogSetting = {
  catalog_type: VehicleReservationCatalogType;
  reservations_enabled: boolean;
  updated_at: string | null;
};

export const VEHICLE_RESERVATION_CATALOG_LABELS: Record<
  VehicleReservationCatalogType,
  string
> = {
  standard: "Catalogue Nostra Motors",
  concession: "Catalogue concession",
  exclusive: "Véhicules exclusifs",
  heavy: "Poids lourds",
  used: "Véhicules d’occasion",
};

function defaultSettings(): VehicleReservationCatalogSetting[] {
  return VEHICLE_RESERVATION_CATALOG_TYPES.map((catalogType) => ({
    catalog_type: catalogType,
    reservations_enabled: true,
    updated_at: null,
  }));
}

function isCatalogType(value: unknown): value is VehicleReservationCatalogType {
  return VEHICLE_RESERVATION_CATALOG_TYPES.includes(
    value as VehicleReservationCatalogType,
  );
}

export async function getVehicleReservationCatalogSettings(): Promise<{
  configured: boolean;
  settings: VehicleReservationCatalogSetting[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_reservation_catalog_settings_v98")
    .select("catalog_type,reservations_enabled,updated_at")
    .order("catalog_type", { ascending: true });

  if (error) {
    return { configured: false, settings: defaultSettings() };
  }

  const byCatalog = new Map<
    VehicleReservationCatalogType,
    VehicleReservationCatalogSetting
  >();

  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    if (!isCatalogType(row.catalog_type)) continue;

    byCatalog.set(row.catalog_type, {
      catalog_type: row.catalog_type,
      reservations_enabled: row.reservations_enabled !== false,
      updated_at:
        typeof row.updated_at === "string" ? row.updated_at : null,
    });
  }

  return {
    configured: true,
    settings: defaultSettings().map(
      (setting) => byCatalog.get(setting.catalog_type) ?? setting,
    ),
  };
}

export async function isVehicleReservationEnabled(
  catalogType: string | null | undefined,
): Promise<boolean> {
  const normalized = isCatalogType(catalogType) ? catalogType : "standard";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_reservation_catalog_settings_v98")
    .select("reservations_enabled")
    .eq("catalog_type", normalized)
    .maybeSingle();

  // Tant que le SQL V98 n’est pas exécuté, le fonctionnement V93 reste actif.
  if (error || !data) return true;
  return data.reservations_enabled !== false;
}
