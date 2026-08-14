import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CatalogVehicleV51 } from "@/lib/catalogues-v51/data";
import { getCatalogVehiclesV51 } from "@/lib/catalogues-v51/data";
import type { ExclusiveCollectionV158 } from "@/lib/v158/exclusive-collections";
import { getExclusiveCollectionsV158 } from "@/lib/v158/exclusive-collections";

export type CollectionMembershipV159 = {
  collectionId: string;
  vehicleId: number;
  sortOrder: number;
};

export type VehicleCollectionMapV159 = Map<number, ExclusiveCollectionV158[]>;

export async function getCollectionMembershipsV159(): Promise<CollectionMembershipV159[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_collection_vehicle_links_v159")
    .select("collection_id,vehicle_id,sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).flatMap((row) => {
    const collectionId = String(row.collection_id ?? "");
    const vehicleId = Number(row.vehicle_id);
    if (!collectionId || !Number.isFinite(vehicleId) || vehicleId <= 0) return [];
    return [{
      collectionId,
      vehicleId,
      sortOrder: Math.max(0, Number(row.sort_order) || 0),
    }];
  });
}

export async function getVehicleCollectionMapV159(
  vehicleIds: number[],
  options: { includeInactive?: boolean } = {},
): Promise<VehicleCollectionMapV159> {
  const ids = [...new Set(vehicleIds.filter((id) => Number.isFinite(id) && id > 0))];
  const result: VehicleCollectionMapV159 = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return result;

  const [collections, memberships] = await Promise.all([
    getExclusiveCollectionsV158({ includeInactive: options.includeInactive }),
    getCollectionMembershipsV159(),
  ]);
  const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));

  for (const membership of memberships) {
    if (!result.has(membership.vehicleId)) continue;
    const collection = collectionsById.get(membership.collectionId);
    if (!collection) continue;
    result.get(membership.vehicleId)?.push(collection);
  }

  for (const [, vehicleCollections] of result) {
    vehicleCollections.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"));
  }

  return result;
}

export async function getCollectionVehicleIdsV159(collectionId: string): Promise<number[]> {
  if (!collectionId) return [];
  const memberships = await getCollectionMembershipsV159();
  return memberships
    .filter((membership) => membership.collectionId === collectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((membership) => membership.vehicleId);
}

export async function getCollectionVehiclesV159(
  collectionId: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<CatalogVehicleV51[]> {
  const [vehicles, vehicleIds] = await Promise.all([
    getCatalogVehiclesV51({ includeUnpublished: options.includeUnpublished }),
    getCollectionVehicleIdsV159(collectionId),
  ]);
  const byId = new Map(vehicles.map((vehicle) => [Number(vehicle.id), vehicle]));
  return vehicleIds.flatMap((id) => {
    const vehicle = byId.get(id);
    return vehicle && vehicle.catalog_type !== "used" ? [vehicle] : [];
  });
}

export async function getExclusiveCatalogueVehiclesV159(): Promise<CatalogVehicleV51[]> {
  const [vehicles, memberships] = await Promise.all([
    getCatalogVehiclesV51(),
    getCollectionMembershipsV159(),
  ]);
  const linkedIds = new Set(memberships.map((membership) => membership.vehicleId));

  return vehicles.filter(
    (vehicle) =>
      vehicle.catalog_type !== "used" &&
      (vehicle.catalog_type === "exclusive" || linkedIds.has(Number(vehicle.id))),
  );
}
