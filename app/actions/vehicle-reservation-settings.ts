"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import {
  VEHICLE_RESERVATION_CATALOG_TYPES,
  type VehicleReservationCatalogType,
} from "@/lib/vehicle-reservation-settings/data";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 80): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: FormDataEntryValue | null): boolean {
  return text(value, 10).toLowerCase() === "true";
}

function isCatalogType(value: string): value is VehicleReservationCatalogType {
  return VEHICLE_RESERVATION_CATALOG_TYPES.includes(
    value as VehicleReservationCatalogType,
  );
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return supabase;
}

function revalidateReservationSettings(vehicleId?: number) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parametres-reservations");
  revalidatePath("/dashboard/controle-vehicules");
  revalidatePath("/dashboard/occasion/catalogue");
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  revalidatePath("/motors/catalogue/poids-lourds");
  revalidatePath("/motors/catalogue/vehicules-occasion");
  revalidatePath("/profil");

  if (vehicleId && vehicleId > 0) {
    revalidatePath(`/motors/catalogue/${vehicleId}/commande`);
  }
}

function errorCode(error: { code?: string | null; message?: string | null }) {
  const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (
    value.includes("pgrst202") ||
    value.includes("set_vehicle_reservation_catalog_v98") ||
    value.includes("set_all_vehicle_reservations_v98")
  ) {
    return "setup-v98";
  }
  if (value.includes("set_vehicle_commerce_availability_v99")) {
    return "setup-v99";
  }
  if (value.includes("forbidden")) return "forbidden";
  if (value.includes("invalid_catalog_type")) return "catalog";
  if (value.includes("vehicle_not_found")) return "vehicle";
  return "save";
}

export async function setVehicleReservationCatalogSetting(
  formData: FormData,
) {
  const catalogType = text(formData.get("catalog_type"), 30);
  const enabled = booleanValue(formData.get("enabled"));

  if (!isCatalogType(catalogType)) {
    redirect("/dashboard/parametres-reservations?error=catalog");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "set_vehicle_reservation_catalog_v98",
    {
      p_catalog_type: catalogType,
      p_enabled: enabled,
    },
  );

  if (error) {
    redirect(
      `/dashboard/parametres-reservations?error=${errorCode(error)}`,
    );
  }

  revalidateReservationSettings();
  redirect(
    `/dashboard/parametres-reservations?saved=1&catalog=${catalogType}`,
  );
}

export async function setAllVehicleReservationCatalogSettings(
  formData: FormData,
) {
  const enabled = booleanValue(formData.get("enabled"));
  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "set_all_vehicle_reservations_v98",
    { p_enabled: enabled },
  );

  if (error) {
    redirect(
      `/dashboard/parametres-reservations?error=${errorCode(error)}`,
    );
  }

  revalidateReservationSettings();
  redirect(
    `/dashboard/parametres-reservations?saved=1&all=${enabled ? "enabled" : "disabled"}`,
  );
}

export async function setVehicleCommerceAvailability(formData: FormData) {
  const vehicleId = integer(formData.get("vehicle_id"));
  const reservationEnabled = booleanValue(
    formData.get("reservation_enabled"),
  );
  const saleEnabled = booleanValue(formData.get("sale_enabled"));

  if (vehicleId <= 0) {
    redirect("/dashboard/controle-vehicules?error=vehicle");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "set_vehicle_commerce_availability_v99",
    {
      p_vehicle_id: vehicleId,
      p_reservation_enabled: reservationEnabled,
      p_sale_enabled: saleEnabled,
    },
  );

  if (error) {
    redirect(
      `/dashboard/controle-vehicules?error=${errorCode(error)}#vehicule-${vehicleId}`,
    );
  }

  revalidateReservationSettings(vehicleId);
  redirect(
    `/dashboard/controle-vehicules?vehicle_saved=1#vehicule-${vehicleId}`,
  );
}
