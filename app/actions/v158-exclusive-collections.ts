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

function revalidateExclusive() {
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  revalidatePath("/profil");
}

function dashboardRedirect(code: string): never {
  redirect(`/dashboard/catalogue?type=exclusive&${code}`);
}

export async function createExclusiveCollectionV158(formData: FormData) {
  const { supabase, user } = await requireManager();
  const name = text(formData.get("name"), 120);
  const description = text(formData.get("description"), 800);
  const sortOrder = Math.max(0, integer(formData.get("sort_order")));
  if (name.length < 2) dashboardRedirect("v158_error=collection-name");

  const { error } = await (supabase as any).from("nostra_exclusive_collections_v158").insert({
    name,
    description,
    sort_order: sortOrder,
    active: true,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) dashboardRedirect("v158_error=collection-save");
  revalidateExclusive();
  dashboardRedirect("v158_saved=collection");
}

export async function updateExclusiveCollectionV158(formData: FormData) {
  const { supabase, user } = await requireManager();
  const collectionId = text(formData.get("collection_id"), 80);
  const name = text(formData.get("name"), 120);
  const description = text(formData.get("description"), 800);
  const sortOrder = Math.max(0, integer(formData.get("sort_order")));
  const active = formData.get("active") === "on";
  if (!collectionId || name.length < 2) dashboardRedirect("v158_error=collection-name");
  const { error } = await (supabase as any)
    .from("nostra_exclusive_collections_v158")
    .update({ name, description, sort_order: sortOrder, active, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", collectionId);
  if (error) dashboardRedirect("v158_error=collection-save");
  revalidateExclusive();
  dashboardRedirect("v158_saved=collection");
}

export async function deleteExclusiveCollectionV158(formData: FormData) {
  const { supabase } = await requireManager();
  const collectionId = text(formData.get("collection_id"), 80);
  if (!collectionId) dashboardRedirect("v158_error=collection");
  const { error } = await (supabase as any)
    .from("nostra_exclusive_collections_v158")
    .delete()
    .eq("id", collectionId);
  if (error) dashboardRedirect("v158_error=collection-delete");
  revalidateExclusive();
  dashboardRedirect("v158_saved=collection-deleted");
}

export async function assignVehicleExclusiveCollectionV158(formData: FormData) {
  const { supabase, user } = await requireManager();
  const vehicleId = integer(formData.get("vehicle_id"));
  const collectionId = text(formData.get("collection_id"), 80);
  if (vehicleId <= 0) dashboardRedirect("v158_error=vehicle");

  const { data: vehicle, error: vehicleError } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,catalog_type")
    .eq("id", vehicleId)
    .maybeSingle();
  if (vehicleError || !vehicle || vehicle.catalog_type !== "exclusive") dashboardRedirect("v158_error=vehicle");

  if (!collectionId) {
    const { error } = await (supabase as any)
      .from("nostra_exclusive_collection_vehicles_v158")
      .delete()
      .eq("vehicle_id", vehicleId);
    if (error) dashboardRedirect("v158_error=assignment");
  } else {
    const { error } = await (supabase as any)
      .from("nostra_exclusive_collection_vehicles_v158")
      .upsert({ vehicle_id: vehicleId, collection_id: collectionId, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "vehicle_id" });
    if (error) dashboardRedirect("v158_error=assignment");
  }

  revalidateExclusive();
  redirect(`/dashboard/catalogue?type=exclusive&v158_saved=assignment#vehicule-${vehicleId}`);
}

export async function addExclusiveCollectionToCartV158(formData: FormData) {
  const collectionId = text(formData.get("collection_id"), 80);
  if (!collectionId) redirect("/motors/catalogue/vehicules-exclusifs?collection_error=invalid");

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data, error } = await (supabase as any).rpc("nostra_add_exclusive_collection_to_cart_v158", {
    p_collection_id: collectionId,
  });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    const code = message.includes("loyalty_tier_required")
      ? "tier"
      : message.includes("insufficient_stock")
        ? "stock"
        : message.includes("vehicle_sale_disabled")
          ? "sale"
          : message.includes("private_sale_required")
            ? "vip"
            : message.includes("collection_empty")
              ? "empty"
              : "save";
    redirect(`/motors/catalogue/vehicules-exclusifs?collection_error=${code}`);
  }

  revalidatePath("/profil");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  void data;
  redirect(`/profil?vehicle_added=1`);
}
