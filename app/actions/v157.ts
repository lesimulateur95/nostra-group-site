"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import {
  normalizeVehicleAccessTierV157,
} from "@/lib/v157/data";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 1000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberValue(value: FormDataEntryValue | null): number {
  const parsed = Number(text(value, 80).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: FormDataEntryValue | null): string | null {
  const raw = text(value, 80);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/dashboard");
  return { supabase, user: data.user };
}

function revalidateVehicle(vehicleId: number) {
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/location");
  revalidatePath("/motors/catalogue/poids-lourds");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  revalidatePath("/motors/catalogue/vehicules-occasion");
  revalidatePath(`/motors/catalogue/${vehicleId}/commande`);
  revalidatePath("/profil");
}

export async function saveVehicleMerchandisingV157(formData: FormData) {
  const { supabase, user } = await requireManager();
  const vehicleId = Number.parseInt(text(formData.get("vehicle_id"), 30), 10);
  const returnTo = text(formData.get("return_to"), 500) || "/dashboard/catalogue";
  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_error=vehicle`);
  }

  const saleEnabled = formData.get("sale_enabled") === "on";
  const saleMode = text(formData.get("sale_mode"), 20) === "price" ? "price" : "percent";
  const saleValue = Math.max(0, numberValue(formData.get("sale_value")));
  const saleStartsAt = dateValue(formData.get("sale_starts_at"));
  const saleEndsAt = dateValue(formData.get("sale_ends_at"));
  const requiredTier = normalizeVehicleAccessTierV157(formData.get("required_tier"));

  if (saleEnabled) {
    if (saleValue <= 0) {
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_error=sale`);
    }
    if (saleMode === "percent" && saleValue >= 100) {
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_error=sale`);
    }
    if (saleStartsAt && saleEndsAt && new Date(saleEndsAt) <= new Date(saleStartsAt)) {
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_error=dates`);
    }
  }

  const { data: vehicle, error: vehicleError } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,price,catalog_type")
    .eq("id", vehicleId)
    .maybeSingle();
  if (vehicleError || !vehicle) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_error=vehicle`);
  }

  // Un véhicule de location n'est pas vendu : on conserve seulement son éventuelle
  // restriction de grade et on ignore toute remise d'achat.
  const isRental = vehicle.catalog_type === "concession";
  const safeSaleEnabled = isRental ? false : saleEnabled;
  const safeSaleValue = isRental ? 0 : saleValue;
  const safeRequiredTier = isRental ? "all" : requiredTier;

  if (safeSaleEnabled && saleMode === "price" && safeSaleValue >= Number(vehicle.price ?? 0)) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_error=sale`);
  }

  const { error } = await (supabase as any)
    .from("nostra_vehicle_merchandising_v157")
    .upsert(
      {
        vehicle_id: vehicleId,
        sale_enabled: safeSaleEnabled,
        sale_mode: saleMode,
        sale_value: safeSaleValue,
        sale_starts_at: safeSaleEnabled ? saleStartsAt : null,
        sale_ends_at: safeSaleEnabled ? saleEndsAt : null,
        required_tier: safeRequiredTier,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vehicle_id" },
    );

  if (error) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_error=save`);
  }

  revalidateVehicle(vehicleId);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}v157_saved=1#vehicule-${vehicleId}`);
}
