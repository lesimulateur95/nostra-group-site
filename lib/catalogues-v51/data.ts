import type {
  CatalogVehicle,
  CatalogVehicleImage,
} from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export const CATALOG_TYPES = [
  "standard",
  "concession",
  "heavy",
  "exclusive",
  "used",
] as const;

export type CatalogType =
  (typeof CATALOG_TYPES)[number];

export type UsedVehicleStatus = "available" | "reserved" | "sold";

export type CatalogVehicleV51 =
  CatalogVehicle & {
    catalog_type: CatalogType;
    used_vehicle_status: UsedVehicleStatus;
    used_condition: string;
  };

export const CATALOG_LABELS: Record<
  CatalogType,
  string
> = {
  standard: "Catalogue principal",
  concession: "Catalogue concession",
  heavy: "Catalogue poids lourd",
  exclusive: "Catalogue véhicules exclusifs",
  used: "Véhicules d’occasion",
};

export const CATALOG_PATHS: Record<
  CatalogType,
  string
> = {
  standard: "/motors/catalogue",
  concession: "/motors/catalogue/concession",
  heavy: "/motors/catalogue/poids-lourds",
  exclusive:
    "/motors/catalogue/vehicules-exclusifs",
  used: "/motors/catalogue/vehicules-occasion",
};

export function normalizeCatalogType(
  value: unknown,
): CatalogType {
  return CATALOG_TYPES.includes(
    value as CatalogType,
  )
    ? (value as CatalogType)
    : "standard";
}

function normalizeImages(
  value: unknown,
): CatalogVehicleImage[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is CatalogVehicleImage => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const row =
        item as Record<string, unknown>;

      return (
        typeof row.url === "string" &&
        typeof row.path === "string"
      );
    },
  );
}

export async function getCataloguesV51Configured(): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("catalog_vehicles")
    .select("id,catalog_type,used_vehicle_status,used_condition")
    .limit(1);

  return !error;
}

export async function getCatalogVehiclesV51({
  includeUnpublished = false,
  catalogType,
}: {
  includeUnpublished?: boolean;
  catalogType?: CatalogType;
} = {}): Promise<CatalogVehicleV51[]> {
  const supabase = await createClient();

  let query = supabase
    .from("catalog_vehicles")
    .select(
      "id,brand,model,trunk_capacity,top_speed,power,price,description,images,published,stock_quantity,sort_order,catalog_type,used_vehicle_status,used_condition,created_at,updated_at",
    )
    .order("brand")
    .order("sort_order")
    .order("model");

  if (!includeUnpublished) {
    query = query.eq("published", true);
  }

  if (catalogType) {
    query = query.eq(
      "catalog_type",
      catalogType,
    );
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map((row) => ({
    id: Number(row.id),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    trunk_capacity: String(
      row.trunk_capacity ?? "",
    ),
    top_speed: String(row.top_speed ?? ""),
    power: String(row.power ?? ""),
    price: Math.max(
      0,
      Number(row.price) || 0,
    ),
    description: String(
      row.description ?? "",
    ),
    images: normalizeImages(row.images),
    published: row.published === true,
    stock_quantity: Math.max(
      0,
      Number(row.stock_quantity) || 0,
    ),
    sort_order: Math.max(
      0,
      Number(row.sort_order) || 0,
    ),
    catalog_type: normalizeCatalogType(
      row.catalog_type,
    ),
    used_vehicle_status:
      row.used_vehicle_status === "reserved" ||
      row.used_vehicle_status === "sold"
        ? row.used_vehicle_status
        : "available",
    used_condition: String(row.used_condition ?? ""),
    created_at:
      typeof row.created_at === "string"
        ? row.created_at
        : null,
    updated_at:
      typeof row.updated_at === "string"
        ? row.updated_at
        : null,
  }));
}
