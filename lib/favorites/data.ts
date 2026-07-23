import {
  CATALOG_LABELS,
  CATALOG_PATHS,
  type CatalogType,
} from "@/lib/catalogues-v51/data";
import { createClient } from "@/lib/supabase/server";

export type FavoriteVehicle = {
  id: number;
  brand: string;
  model: string;
  price: number;
  imageUrl: string | null;
  stockQuantity: number;
  catalogType: CatalogType;
  catalogLabel: string;
  catalogPath: string;
  stockAlert: boolean;
  addedAt: string;
};

export type FavoriteVehicleStat = {
  vehicleId: number;
  brand: string;
  model: string;
  catalogType: CatalogType;
  catalogLabel: string;
  catalogPath: string;
  stockQuantity: number;
  favoritesCount: number;
  alertsCount: number;
  imageUrl: string | null;
};

type FavoriteRow = {
  vehicle_id: number | string;
  stock_alert: boolean | null;
  created_at: string;
};

type CatalogVehicleRow = {
  id: number | string;
  brand: string | null;
  model: string | null;
  price: number | string | null;
  images: unknown;
  stock_quantity: number | string | null;
  catalog_type: string | null;
};

type FavoriteStatRow = {
  vehicle_id: number | string;
  brand: string | null;
  model: string | null;
  catalog_type: string | null;
  stock_quantity: number | string | null;
  favorites_count: number | string | null;
  alerts_count: number | string | null;
  image_url: string | null;
};

function normalizeCatalogType(value: unknown): CatalogType {
  return value === "heavy" || value === "exclusive" ? value : "standard";
}

function extractFirstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (!first || typeof first !== "object") return null;
  const url = (first as { url?: unknown }).url;
  return typeof url === "string" && url.trim() ? url : null;
}


export async function getCurrentFavoriteStateMap(
  vehicleIds: number[],
): Promise<Map<number, { favorite: boolean; stockAlert: boolean }>> {
  const state = new Map<number, { favorite: boolean; stockAlert: boolean }>();
  if (vehicleIds.length === 0) return state;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return state;

  const result = await supabase
    .from("vehicle_favorites")
    .select("vehicle_id,stock_alert")
    .eq("user_id", authData.user.id)
    .in("vehicle_id", vehicleIds);

  if (result.error) return state;

  for (const row of (result.data ?? []) as Array<{
    vehicle_id: number | string;
    stock_alert: boolean | null;
  }>) {
    state.set(Number(row.vehicle_id), {
      favorite: true,
      stockAlert: row.stock_alert === true,
    });
  }

  return state;
}

export async function getMyFavoriteVehicles(
  userId: string,
): Promise<{
  configured: boolean;
  favorites: FavoriteVehicle[];
  error?: string;
}> {
  const supabase = await createClient();
  const favoriteResult = await supabase
    .from("vehicle_favorites")
    .select("vehicle_id,stock_alert,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (favoriteResult.error) {
    return {
      configured: false,
      favorites: [],
      error: favoriteResult.error.message,
    };
  }

  const favoriteRows = (favoriteResult.data ?? []) as FavoriteRow[];
  if (favoriteRows.length === 0) {
    return { configured: true, favorites: [] };
  }

  const ids = favoriteRows.map((row) => Number(row.vehicle_id));
  const vehicleResult = await supabase
    .from("catalog_vehicles")
    .select("id,brand,model,price,images,stock_quantity,catalog_type")
    .in("id", ids);

  if (vehicleResult.error) {
    return {
      configured: true,
      favorites: [],
      error: vehicleResult.error.message,
    };
  }

  const vehicles = new Map<number, CatalogVehicleRow>();
  for (const row of (vehicleResult.data ?? []) as CatalogVehicleRow[]) {
    vehicles.set(Number(row.id), row);
  }

  const favorites = favoriteRows.flatMap((favorite): FavoriteVehicle[] => {
    const vehicle = vehicles.get(Number(favorite.vehicle_id));
    if (!vehicle) return [];

    const catalogType = normalizeCatalogType(vehicle.catalog_type);
    return [
      {
        id: Number(vehicle.id),
        brand: vehicle.brand?.trim() || "Nostra Motors",
        model: vehicle.model?.trim() || "Véhicule",
        price: Number(vehicle.price ?? 0),
        imageUrl: extractFirstImageUrl(vehicle.images),
        stockQuantity: Number(vehicle.stock_quantity ?? 0),
        catalogType,
        catalogLabel: CATALOG_LABELS[catalogType],
        catalogPath: CATALOG_PATHS[catalogType],
        stockAlert: favorite.stock_alert === true,
        addedAt: favorite.created_at,
      },
    ];
  });

  return { configured: true, favorites };
}

export async function getVehicleFavoriteStats(): Promise<{
  configured: boolean;
  vehicles: FavoriteVehicleStat[];
  error?: string;
}> {
  const supabase = await createClient();
  const result = await supabase.rpc("get_nostra_vehicle_favorite_stats");

  if (result.error) {
    return {
      configured: false,
      vehicles: [],
      error: result.error.message,
    };
  }

  const vehicles = ((result.data ?? []) as FavoriteStatRow[]).map(
    (row): FavoriteVehicleStat => {
      const catalogType = normalizeCatalogType(row.catalog_type);
      return {
        vehicleId: Number(row.vehicle_id),
        brand: row.brand?.trim() || "Nostra Motors",
        model: row.model?.trim() || "Véhicule",
        catalogType,
        catalogLabel: CATALOG_LABELS[catalogType],
        catalogPath: CATALOG_PATHS[catalogType],
        stockQuantity: Number(row.stock_quantity ?? 0),
        favoritesCount: Number(row.favorites_count ?? 0),
        alertsCount: Number(row.alerts_count ?? 0),
        imageUrl: row.image_url,
      };
    },
  );

  return { configured: true, vehicles };
}
