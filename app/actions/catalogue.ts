"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/auth/access";
import type { CatalogVehicleImage } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: FormDataEntryValue | null): number {
  const raw = text(value, 60).replace(/\s|€|\$/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function imageFiles(formData: FormData): File[] {
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function validStoredImages(value: unknown): CatalogVehicleImage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CatalogVehicleImage => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.url === "string" && typeof candidate.path === "string";
  });
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

async function removeUploadedFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  if (paths.length > 0) await supabase.storage.from("vehicle-images").remove(paths);
}

export async function saveCatalogVehicle(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const brand = text(formData.get("brand"), 100);
  const model = text(formData.get("model"), 140);
  const trunkCapacity = text(formData.get("trunk_capacity"), 100);
  const topSpeed = text(formData.get("top_speed"), 100);
  const power = text(formData.get("power"), 100);
  const price = money(formData.get("price"));
  const description = text(formData.get("description"), 4000);
  const sortOrder = Math.max(0, integer(formData.get("sort_order"), 0));
  const published = checkbox(formData.get("published"));

  if (brand.length < 2 || model.length < 1 || price < 0) {
    redirect("/dashboard/catalogue?error=invalid");
  }

  const files = imageFiles(formData);
  if (files.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) {
    redirect("/dashboard/catalogue?error=image-type");
  }
  if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
    redirect("/dashboard/catalogue?error=image-size");
  }

  const { supabase, user } = await requireManager();

  let currentImages: CatalogVehicleImage[] = [];
  if (id > 0) {
    const { data, error } = await supabase
      .from("catalog_vehicles")
      .select("images")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) redirect("/dashboard/catalogue?error=not-found");
    currentImages = validStoredImages(data.images);
  }

  const removePaths = new Set(
    formData
      .getAll("remove_images")
      .filter((value): value is string => typeof value === "string"),
  );
  const keptImages = currentImages.filter((image) => !removePaths.has(image.path));

  if (keptImages.length + files.length > MAX_IMAGES) {
    redirect("/dashboard/catalogue?error=too-many");
  }

  const uploadedImages: CatalogVehicleImage[] = [];
  for (const file of files) {
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const { error } = await supabase.storage.from("vehicle-images").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      await removeUploadedFiles(supabase, uploadedImages.map((image) => image.path));
      redirect("/dashboard/catalogue?error=upload");
    }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
    uploadedImages.push({ path, url: data.publicUrl });
  }

  const payload = {
    brand,
    model,
    trunk_capacity: trunkCapacity,
    top_speed: topSpeed,
    power,
    price,
    description,
    images: [...keptImages, ...uploadedImages],
    published,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const result = id > 0
    ? await supabase.from("catalog_vehicles").update(payload).eq("id", id)
    : await supabase.from("catalog_vehicles").insert(payload);

  if (result.error) {
    await removeUploadedFiles(supabase, uploadedImages.map((image) => image.path));
    redirect("/dashboard/catalogue?error=save");
  }

  await removeUploadedFiles(supabase, [...removePaths]);
  revalidatePath("/motors/catalogue");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard");
  redirect("/dashboard/catalogue?saved=1");
}


export async function addCatalogVehicleToCart(formData: FormData) {
  const vehicleId = integer(formData.get("vehicle_id"), 0);
  if (vehicleId <= 0) redirect("/motors/catalogue?cart_error=invalid");

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data: vehicle, error: vehicleError } = await supabase
    .from("catalog_vehicles")
    .select("id,brand,model,price,images,published")
    .eq("id", vehicleId)
    .eq("published", true)
    .maybeSingle();

  if (vehicleError || !vehicle) redirect("/motors/catalogue?cart_error=not-found");

  const itemName = `${String(vehicle.brand).trim()} ${String(vehicle.model).trim()}`.trim();
  const images = validStoredImages(vehicle.images);
  const imageUrl = images[0]?.url ?? null;

  const { data: existing, error: existingError } = await supabase
    .from("cart_items")
    .select("id,quantity")
    .eq("user_id", authData.user.id)
    .eq("item_name", itemName)
    .limit(1)
    .maybeSingle();

  if (existingError) redirect("/motors/catalogue?cart_error=unavailable");

  const result = existing
    ? await supabase
        .from("cart_items")
        .update({ quantity: Number(existing.quantity) + 1 })
        .eq("id", existing.id)
        .eq("user_id", authData.user.id)
    : await supabase.from("cart_items").insert({
        user_id: authData.user.id,
        item_name: itemName,
        quantity: 1,
        unit_price: Number(vehicle.price) || 0,
        image_url: imageUrl,
      });

  if (result.error) redirect("/motors/catalogue?cart_error=save");

  revalidatePath("/motors/catalogue");
  revalidatePath("/profil");
  redirect("/motors/catalogue?cart_added=1");
}

export async function deleteCatalogVehicle(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  if (id <= 0) redirect("/dashboard/catalogue?error=invalid");

  const { supabase } = await requireManager();
  const { data } = await supabase
    .from("catalog_vehicles")
    .select("images")
    .eq("id", id)
    .maybeSingle();
  const images = validStoredImages(data?.images);

  const { error } = await supabase.from("catalog_vehicles").delete().eq("id", id);
  if (error) redirect("/dashboard/catalogue?error=delete");

  await removeUploadedFiles(supabase, images.map((image) => image.path));
  revalidatePath("/motors/catalogue");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard");
  redirect("/dashboard/catalogue?deleted=1");
}
