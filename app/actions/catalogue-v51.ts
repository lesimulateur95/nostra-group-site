"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  hasDashboardAccess,
} from "@/lib/auth/access";
import type {
  CatalogVehicleImage,
} from "@/lib/backoffice/data";
import {
  CATALOG_PATHS,
  normalizeCatalogType,
  type CatalogType,
} from "@/lib/catalogues-v51/data";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function text(
  value: FormDataEntryValue | null,
  max = 5000,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function integer(
  value: FormDataEntryValue | null,
  fallback = 0,
): number {
  const parsed = Number.parseInt(
    text(value, 30),
    10,
  );

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function money(
  value: FormDataEntryValue | null,
): number {
  const raw = text(value, 60).replace(
    /\s|€|\$/g,
    "",
  );

  if (!raw) return 0;

  const normalized = raw.includes(",")
    ? raw
        .replace(/\./g, "")
        .replace(",", ".")
    : raw;

  const parsed =
    Number.parseFloat(normalized);

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : 0;
}

function checkbox(
  value: FormDataEntryValue | null,
): boolean {
  return (
    value === "on" ||
    value === "true" ||
    value === "1"
  );
}

function images(
  formData: FormData,
): File[] {
  return formData
    .getAll("images")
    .filter(
      (value): value is File =>
        value instanceof File &&
        value.size > 0,
    );
}

function extensionFor(
  type: string,
): string {
  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function storedImages(
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

async function requireManager() {
  const supabase =
    await createClient();

  const { data } =
    await supabase.auth.getUser();

  if (!data.user) redirect("/");

  if (
    !(await hasDashboardAccess(
      data.user,
    ))
  ) {
    redirect("/accueil");
  }

  return {
    supabase,
    user: data.user,
  };
}

function dashboardUrl(
  type: CatalogType,
  result: string,
): string {
  return `/dashboard/catalogue?type=${type}&${result}`;
}

function revalidateCatalogs() {
  revalidatePath("/motors/catalogue");
  revalidatePath(
    "/motors/catalogue/poids-lourds",
  );
  revalidatePath(
    "/motors/catalogue/vehicules-exclusifs",
  );
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/profil");
}

export async function saveCatalogVehicleV51(
  formData: FormData,
) {
  const id = integer(
    formData.get("id"),
    0,
  );

  const catalogType =
    normalizeCatalogType(
      text(
        formData.get("catalog_type"),
        30,
      ),
    );

  const brand = text(
    formData.get("brand"),
    100,
  );
  const model = text(
    formData.get("model"),
    140,
  );
  const price = money(
    formData.get("price"),
  );
  const stockQuantity = Math.max(
    0,
    integer(
      formData.get("stock_quantity"),
      0,
    ),
  );

  if (
    brand.length < 2 ||
    model.length < 1
  ) {
    redirect(
      dashboardUrl(
        catalogType,
        "error=invalid",
      ),
    );
  }

  const newImages = images(formData);

  if (
    newImages.some(
      (file) =>
        !ALLOWED_IMAGE_TYPES.has(
          file.type,
        ),
    )
  ) {
    redirect(
      dashboardUrl(
        catalogType,
        "error=image-type",
      ),
    );
  }

  if (
    newImages.some(
      (file) =>
        file.size > MAX_IMAGE_SIZE,
    )
  ) {
    redirect(
      dashboardUrl(
        catalogType,
        "error=image-size",
      ),
    );
  }

  const { supabase, user } =
    await requireManager();

  let current:
    CatalogVehicleImage[] = [];

  if (id > 0) {
    const { data, error } =
      await supabase
        .from("catalog_vehicles")
        .select("images")
        .eq("id", id)
        .maybeSingle();

    if (error || !data) {
      redirect(
        dashboardUrl(
          catalogType,
          "error=not-found",
        ),
      );
    }

    current = storedImages(data.images);
  }

  const removePaths = new Set(
    formData
      .getAll("remove_images")
      .filter(
        (value): value is string =>
          typeof value === "string",
      ),
  );

  const kept = current.filter(
    (image) =>
      !removePaths.has(image.path),
  );

  if (
    kept.length +
      newImages.length >
    MAX_IMAGES
  ) {
    redirect(
      dashboardUrl(
        catalogType,
        "error=too-many",
      ),
    );
  }

  const uploaded:
    CatalogVehicleImage[] = [];

  for (const file of newImages) {
    const path =
      `${user.id}/${Date.now()}-` +
      `${crypto.randomUUID()}.` +
      extensionFor(file.type);

    const { error } =
      await supabase.storage
        .from("vehicle-images")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

    if (error) {
      if (uploaded.length) {
        await supabase.storage
          .from("vehicle-images")
          .remove(
            uploaded.map(
              (image) => image.path,
            ),
          );
      }

      redirect(
        dashboardUrl(
          catalogType,
          "error=upload",
        ),
      );
    }

    const { data } =
      supabase.storage
        .from("vehicle-images")
        .getPublicUrl(path);

    uploaded.push({
      path,
      url: data.publicUrl,
    });
  }

  const payload = {
    catalog_type: catalogType,
    brand,
    model,
    trunk_capacity: text(
      formData.get("trunk_capacity"),
      100,
    ),
    top_speed: text(
      formData.get("top_speed"),
      100,
    ),
    power: text(
      formData.get("power"),
      100,
    ),
    price,
    stock_quantity: stockQuantity,
    description: text(
      formData.get("description"),
      4000,
    ),
    images: [...kept, ...uploaded],
    published: checkbox(
      formData.get("published"),
    ),
    sort_order: Math.max(
      0,
      integer(
        formData.get("sort_order"),
        0,
      ),
    ),
    updated_at:
      new Date().toISOString(),
    updated_by: user.id,
  };

  const result =
    id > 0
      ? await supabase
          .from("catalog_vehicles")
          .update(payload)
          .eq("id", id)
      : await supabase
          .from("catalog_vehicles")
          .insert(payload);

  if (result.error) {
    if (uploaded.length) {
      await supabase.storage
        .from("vehicle-images")
        .remove(
          uploaded.map(
            (image) => image.path,
          ),
        );
    }

    redirect(
      dashboardUrl(
        catalogType,
        "error=save",
      ),
    );
  }

  if (removePaths.size) {
    await supabase.storage
      .from("vehicle-images")
      .remove([...removePaths]);
  }

  revalidateCatalogs();

  redirect(
    dashboardUrl(
      catalogType,
      "saved=1",
    ),
  );
}

export async function deleteCatalogVehicleV51(
  formData: FormData,
) {
  const id = integer(
    formData.get("id"),
    0,
  );

  const catalogType =
    normalizeCatalogType(
      text(
        formData.get("catalog_type"),
        30,
      ),
    );

  if (id <= 0) {
    redirect(
      dashboardUrl(
        catalogType,
        "error=invalid",
      ),
    );
  }

  const { supabase } =
    await requireManager();

  const { data } = await supabase
    .from("catalog_vehicles")
    .select("brand,model,images")
    .eq("id", id)
    .maybeSingle();

  const vehicleImages =
    storedImages(data?.images);

  const itemName = data
    ? `${String(data.brand).trim()} ${String(
        data.model,
      ).trim()}`.trim()
    : "";

  await supabase
    .from("cart_items")
    .delete()
    .eq("vehicle_id", id);

  await supabase
    .from("cart_items")
    .delete()
    .eq("related_vehicle_id", id);

  if (itemName) {
    await supabase
      .from("cart_items")
      .delete()
      .eq("item_name", itemName);
  }

  const { error } = await supabase
    .from("catalog_vehicles")
    .delete()
    .eq("id", id);

  if (error) {
    redirect(
      dashboardUrl(
        catalogType,
        "error=delete",
      ),
    );
  }

  if (vehicleImages.length) {
    await supabase.storage
      .from("vehicle-images")
      .remove(
        vehicleImages.map(
          (image) => image.path,
        ),
      );
  }

  revalidateCatalogs();

  redirect(
    dashboardUrl(
      catalogType,
      "deleted=1",
    ),
  );
}
