import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ExclusiveCollectionV158 = {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  sortOrder: number;
};

export type ExclusiveCollectionVehicleMapV158 = Map<number, ExclusiveCollectionV158>;

function normalizeCollection(row: Record<string, unknown>): ExclusiveCollectionV158 {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Collection exclusive"),
    slug: String(row.slug ?? ""),
    description: String(row.description ?? ""),
    active: row.active !== false,
    sortOrder: Math.max(0, Number(row.sort_order) || 0),
  };
}

export async function getExclusiveCollectionsV158(options: { includeInactive?: boolean } = {}): Promise<ExclusiveCollectionV158[]> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("nostra_exclusive_collections_v158")
    .select("id,name,slug,description,active,sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options.includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeCollection);
}

export async function getExclusiveCollectionVehicleMapV158(vehicleIds: number[]): Promise<ExclusiveCollectionVehicleMapV158> {
  const result = new Map<number, ExclusiveCollectionV158>();
  const ids = [...new Set(vehicleIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return result;

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_exclusive_collection_vehicles_v158")
    .select("vehicle_id,collection:nostra_exclusive_collections_v158(id,name,slug,description,active,sort_order)")
    .in("vehicle_id", ids);
  if (error || !data) return result;

  for (const row of data as Array<Record<string, unknown>>) {
    const vehicleId = Number(row.vehicle_id);
    const rawCollection = row.collection;
    const collection = Array.isArray(rawCollection) ? rawCollection[0] : rawCollection;
    if (!Number.isFinite(vehicleId) || !collection || typeof collection !== "object") continue;
    result.set(vehicleId, normalizeCollection(collection as Record<string, unknown>));
  }
  return result;
}

export async function getExclusiveCollectionVehicleIdsV158(collectionId: string): Promise<number[]> {
  if (!collectionId) return [];
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_exclusive_collection_vehicles_v158")
    .select("vehicle_id")
    .eq("collection_id", collectionId);
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>)
    .map((row) => Number(row.vehicle_id))
    .filter((id) => Number.isFinite(id) && id > 0);
}
