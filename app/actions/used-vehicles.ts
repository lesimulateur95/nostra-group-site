"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import type { CatalogVehicleImage } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE = 7 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: FormDataEntryValue | null): number {
  const raw = text(value, 80).replace(/\s|€|\$/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function files(formData: FormData): File[] {
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function normalizeStoredImages(value: unknown): CatalogVehicleImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || typeof row.path !== "string") return [];
    return [{ url: row.url, path: row.path }];
  });
}

async function requireUsedVehicleStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) {
    redirect("/accueil");
  }

  return { supabase, user: data.user };
}

function errorText(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined) {
  return `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
}

function errorCode(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined): string {
  const value = errorText(error);
  if (value.includes("forbidden")) return "forbidden";
  if (value.includes("registration_already_exists")) return "registration";
  if (value.includes("vehicle_not_found")) return "not-found";
  if (value.includes("vehicle_has_active_order")) return "active-order";
  if (value.includes("vehicle_has_sales")) return "sales";
  if (value.includes("available_requires_stock")) return "stock";
  if (value.includes("invalid_used_vehicle")) return "invalid";
  if (value.includes("used_vehicle_unavailable")) return "unavailable";
  if (value.includes("pgrst202") || value.includes("used_vehicle")) return "setup";
  return "save";
}

async function uploadImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  selected: File[],
): Promise<CatalogVehicleImage[]> {
  const uploaded: CatalogVehicleImage[] = [];

  for (const file of selected) {
    const path = `used/${userId}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const result = await supabase.storage.from("vehicle-images").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

    if (result.error) {
      if (uploaded.length > 0) {
        await supabase.storage.from("vehicle-images").remove(uploaded.map((image) => image.path));
      }
      throw result.error;
    }

    const publicUrl = supabase.storage.from("vehicle-images").getPublicUrl(path);
    uploaded.push({ path, url: publicUrl.data.publicUrl });
  }

  return uploaded;
}

function revalidateUsedVehiclePaths(vehicleId?: number) {
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/vehicules-occasion");
  if (vehicleId) revalidatePath(`/motors/catalogue/${vehicleId}/commande`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/dashboard/comptabilite");
  revalidatePath("/dashboard/occasion");
  revalidatePath("/dashboard/occasion/rachats");
  revalidatePath("/dashboard/occasion/catalogue");
  revalidatePath("/dashboard/occasion/stocks");
  revalidatePath("/dashboard/occasion/commandes");
  revalidatePath("/dashboard/occasion/ventes");
  revalidatePath("/dashboard/occasion/clients");
  revalidatePath("/dashboard/occasion/documents");
  revalidatePath("/dashboard/occasion/statistiques");
  revalidatePath("/profil");
  revalidatePath("/profil/commandes");
  revalidatePath("/profil/reservations-vehicules");
  revalidatePath("/profil/documents");
  revalidatePath("/dashboard/reservations-vehicules");
}

function validateImages(selected: File[], existingCount = 0): string | null {
  if (selected.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) return "image-type";
  if (selected.some((file) => file.size > MAX_IMAGE_SIZE)) return "image-size";
  if (selected.length + existingCount > MAX_IMAGES) return "too-many";
  return null;
}

export async function createUsedVehiclePurchase(formData: FormData) {
  const brand = text(formData.get("brand"), 100);
  const model = text(formData.get("model"), 140);
  const version = text(formData.get("version"), 140);
  const registration = text(formData.get("registration"), 40).toUpperCase();
  const purchaseDate = text(formData.get("purchase_date"), 20);
  const purchasePrice = money(formData.get("purchase_price"));
  const resalePrice = money(formData.get("resale_price"));
  const quantity = Math.max(1, integer(formData.get("quantity"), 1));
  const selected = files(formData);

  if (!brand || !model || !purchaseDate || purchasePrice <= 0 || resalePrice <= 0) {
    redirect("/dashboard/occasion/rachats?error=invalid");
  }

  const imageError = validateImages(selected);
  if (imageError) redirect(`/dashboard/occasion/rachats?error=${imageError}`);

  const { supabase, user } = await requireUsedVehicleStaff();
  let uploaded: CatalogVehicleImage[] = [];

  try {
    uploaded = await uploadImages(supabase, user.id, selected);
  } catch {
    redirect("/dashboard/occasion/rachats?error=upload");
  }

  const result = await (supabase as any).rpc("create_used_vehicle_v92", {
    p_brand: brand,
    p_model: model,
    p_version: version || null,
    p_registration: registration || null,
    p_previous_owner: text(formData.get("previous_owner"), 180) || null,
    p_purchase_date: purchaseDate,
    p_purchase_price: purchasePrice,
    p_resale_price: resalePrice,
    p_quantity: quantity,
    p_images: uploaded,
    p_description: text(formData.get("description"), 5000),
    p_condition: text(formData.get("vehicle_condition"), 30) || "good",
    p_internal_notes: text(formData.get("internal_notes"), 5000) || null,
    p_trunk_capacity: text(formData.get("trunk_capacity"), 100),
    p_top_speed: text(formData.get("top_speed"), 100),
    p_power: text(formData.get("power"), 100),
    p_sort_order: Math.max(0, integer(formData.get("sort_order"), 0)),
    p_published: checkbox(formData.get("published")),
  });

  if (result.error) {
    if (uploaded.length > 0) {
      await supabase.storage.from("vehicle-images").remove(uploaded.map((image) => image.path));
    }
    redirect(`/dashboard/occasion/rachats?error=${errorCode(result.error)}`);
  }

  revalidateUsedVehiclePaths(Number(result.data ?? 0));
  redirect("/dashboard/occasion/rachats?created=1");
}

export async function updateUsedVehiclePurchase(formData: FormData) {
  const vehicleId = integer(formData.get("vehicle_id"));
  if (vehicleId <= 0) redirect("/dashboard/occasion/rachats?error=invalid");

  const { supabase, user } = await requireUsedVehicleStaff();
  const existingResult = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,images,catalog_type")
    .eq("id", vehicleId)
    .maybeSingle();

  if (existingResult.error || !existingResult.data || existingResult.data.catalog_type !== "used") {
    redirect("/dashboard/occasion/rachats?error=not-found");
  }

  const current = normalizeStoredImages(existingResult.data.images);
  const removePaths = new Set(
    formData
      .getAll("remove_images")
      .filter((value): value is string => typeof value === "string"),
  );
  const kept = current.filter((image) => !removePaths.has(image.path));
  const selected = files(formData);
  const imageError = validateImages(selected, kept.length);
  if (imageError) redirect(`/dashboard/occasion/rachats?error=${imageError}`);

  let uploaded: CatalogVehicleImage[] = [];
  try {
    uploaded = await uploadImages(supabase, user.id, selected);
  } catch {
    redirect("/dashboard/occasion/rachats?error=upload");
  }

  const result = await (supabase as any).rpc("update_used_vehicle_v92", {
    p_vehicle_id: vehicleId,
    p_brand: text(formData.get("brand"), 100),
    p_model: text(formData.get("model"), 140),
    p_version: text(formData.get("version"), 140) || null,
    p_registration: text(formData.get("registration"), 40).toUpperCase() || null,
    p_previous_owner: text(formData.get("previous_owner"), 180) || null,
    p_purchase_date: text(formData.get("purchase_date"), 20),
    p_purchase_price: money(formData.get("purchase_price")),
    p_resale_price: money(formData.get("resale_price")),
    p_quantity: Math.max(1, integer(formData.get("quantity"), 1)),
    p_images: [...kept, ...uploaded],
    p_description: text(formData.get("description"), 5000),
    p_condition: text(formData.get("vehicle_condition"), 30) || "good",
    p_internal_notes: text(formData.get("internal_notes"), 5000) || null,
    p_trunk_capacity: text(formData.get("trunk_capacity"), 100),
    p_top_speed: text(formData.get("top_speed"), 100),
    p_power: text(formData.get("power"), 100),
    p_sort_order: Math.max(0, integer(formData.get("sort_order"), 0)),
    p_published: checkbox(formData.get("published")),
  });

  if (result.error) {
    if (uploaded.length > 0) {
      await supabase.storage.from("vehicle-images").remove(uploaded.map((image) => image.path));
    }
    redirect(`/dashboard/occasion/rachats?error=${errorCode(result.error)}`);
  }

  if (removePaths.size > 0) {
    await supabase.storage.from("vehicle-images").remove([...removePaths]);
  }

  revalidateUsedVehiclePaths(vehicleId);
  redirect("/dashboard/occasion/rachats?updated=1");
}

export async function deleteUsedVehiclePurchase(formData: FormData) {
  const vehicleId = integer(formData.get("vehicle_id"));
  const returnTo =
    text(formData.get("return_to"), 30) === "catalogue"
      ? "/dashboard/occasion/catalogue"
      : "/dashboard/occasion/rachats";

  if (vehicleId <= 0) redirect(`${returnTo}?error=invalid`);

  const { supabase } = await requireUsedVehicleStaff();
  const current = await (supabase as any)
    .from("catalog_vehicles")
    .select("images,catalog_type")
    .eq("id", vehicleId)
    .maybeSingle();

  if (
    current.error ||
    !current.data ||
    current.data.catalog_type !== "used"
  ) {
    redirect(`${returnTo}?error=not-found`);
  }

  const stored = normalizeStoredImages(current.data.images);
  const result = await (supabase as any).rpc("delete_used_vehicle_v92", {
    p_vehicle_id: vehicleId,
  });

  if (result.error) {
    redirect(`${returnTo}?error=${errorCode(result.error)}`);
  }

  if (stored.length > 0) {
    await supabase.storage
      .from("vehicle-images")
      .remove(stored.map((image) => image.path));
  }

  revalidateUsedVehiclePaths(vehicleId);
  redirect(`${returnTo}?deleted=1`);
}

export async function updateUsedVehicleStock(formData: FormData) {
  const vehicleId = integer(formData.get("vehicle_id"));
  const stockQuantity = Math.max(0, integer(formData.get("stock_quantity"), 0));
  const requestedStatus = text(formData.get("sale_status"), 20);
  if (vehicleId <= 0) redirect("/dashboard/occasion/stocks?error=invalid");

  const { supabase } = await requireUsedVehicleStaff();
  const result = await (supabase as any).rpc("update_used_vehicle_stock_v92", {
    p_vehicle_id: vehicleId,
    p_stock_quantity: stockQuantity,
    p_sale_status: requestedStatus || null,
  });

  if (result.error) redirect(`/dashboard/occasion/stocks?error=${errorCode(result.error)}`);
  revalidateUsedVehiclePaths(vehicleId);
  redirect("/dashboard/occasion/stocks?saved=1");
}

export async function toggleUsedVehiclePublication(formData: FormData) {
  const vehicleId = integer(formData.get("vehicle_id"));
  const published = checkbox(formData.get("published"));
  if (vehicleId <= 0) redirect("/dashboard/occasion/catalogue?error=invalid");

  const { supabase } = await requireUsedVehicleStaff();
  const result = await (supabase as any).rpc("publish_used_vehicle_v92", {
    p_vehicle_id: vehicleId,
    p_published: published,
  });

  if (result.error) redirect(`/dashboard/occasion/catalogue?error=${errorCode(result.error)}`);
  revalidateUsedVehiclePaths(vehicleId);
  redirect("/dashboard/occasion/catalogue?saved=1");
}

export async function updateUsedVehicleOrder(formData: FormData) {
  const orderId = integer(formData.get("id"));
  const status = text(formData.get("status"), 30);
  const adminNote = text(formData.get("admin_note"), 2000) || null;
  if (!new Set(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]).has(status)) {
    redirect("/dashboard/occasion/commandes?error=invalid");
  }

  const { supabase } = await requireUsedVehicleStaff();
  const result = await supabase.rpc("update_nostra_order", {
    p_order_id: orderId,
    p_status: status,
    p_admin_note: adminNote,
  });
  if (result.error) redirect(`/dashboard/occasion/commandes?error=${errorCode(result.error)}`);

  revalidateUsedVehiclePaths();
  redirect("/dashboard/occasion/commandes?saved=1");
}

export async function deleteUsedVehicleOrder(formData: FormData) {
  const orderId = integer(formData.get("id"));
  if (orderId <= 0) redirect("/dashboard/occasion/commandes?error=invalid");

  const { supabase } = await requireUsedVehicleStaff();
  const result = await supabase.rpc("delete_nostra_order", { p_order_id: orderId });
  if (result.error) redirect(`/dashboard/occasion/commandes?error=${errorCode(result.error)}`);

  revalidateUsedVehiclePaths();
  redirect("/dashboard/occasion/commandes?deleted=1");
}
