"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/dashboard");
  return { supabase, user: data.user };
}

function revalidateCollections() {
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/poids-lourds");
  revalidatePath("/motors/catalogue/location");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  revalidatePath("/profil");
}

function collectionRedirect(code: string, collectionId?: string): never {
  const anchor = collectionId ? `#collection-${collectionId}` : "";
  redirect(`/dashboard/catalogue?type=exclusive&${code}${anchor}`);
}

export async function addExistingVehicleToCollectionV159(formData: FormData) {
  const { supabase, user } = await requireManager();
  const collectionId = text(formData.get("collection_id"), 80);
  const vehicleId = integer(formData.get("vehicle_id"));
  if (!collectionId || vehicleId <= 0) collectionRedirect("v159_error=invalid", collectionId);

  const [{ data: collection, error: collectionError }, { data: vehicle, error: vehicleError }] = await Promise.all([
    (supabase as any)
      .from("nostra_exclusive_collections_v158")
      .select("id")
      .eq("id", collectionId)
      .maybeSingle(),
    (supabase as any)
      .from("catalog_vehicles")
      .select("id,catalog_type")
      .eq("id", vehicleId)
      .maybeSingle(),
  ]);

  if (collectionError || !collection) collectionRedirect("v159_error=collection", collectionId);
  if (vehicleError || !vehicle || vehicle.catalog_type === "used") {
    collectionRedirect("v159_error=vehicle", collectionId);
  }

  const { error } = await (supabase as any)
    .from("nostra_collection_vehicle_links_v159")
    .upsert(
      {
        collection_id: collectionId,
        vehicle_id: vehicleId,
        created_by: user.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "collection_id,vehicle_id" },
    );

  if (error) collectionRedirect("v159_error=setup", collectionId);
  revalidateCollections();
  collectionRedirect("v159_saved=vehicle-added", collectionId);
}

export async function removeVehicleFromCollectionV159(formData: FormData) {
  const { supabase } = await requireManager();
  const collectionId = text(formData.get("collection_id"), 80);
  const vehicleId = integer(formData.get("vehicle_id"));
  if (!collectionId || vehicleId <= 0) collectionRedirect("v159_error=invalid", collectionId);

  const { error } = await (supabase as any)
    .from("nostra_collection_vehicle_links_v159")
    .delete()
    .eq("collection_id", collectionId)
    .eq("vehicle_id", vehicleId);

  if (error) collectionRedirect("v159_error=setup", collectionId);
  revalidateCollections();
  collectionRedirect("v159_saved=vehicle-removed", collectionId);
}
