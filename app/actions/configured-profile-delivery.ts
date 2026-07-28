"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isVehicleReservationEnabled } from "@/lib/vehicle-reservation-settings/data";

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function configuredCartErrorCode(
  error:
    | {
        code?: string | null;
        message?: string | null;
        details?: string | null;
      }
    | null
    | undefined,
): string {
  const value = `${error?.code ?? ""} ${error?.message ?? ""} ${
    error?.details ?? ""
  }`.toLowerCase();

  if (
    value.includes("pgrst202") ||
    value.includes("add_vehicle_purchase_to_cart_v93") ||
    value.includes("reservation_id") ||
    value.includes("original_unit_price") ||
    value.includes("delivery_phone")
  ) {
    return "setup";
  }

  if (value.includes("heavy_home_delivery_disabled")) return "heavy-delivery";
  if (value.includes("used_vehicle_unavailable")) return "used-unavailable";
  if (value.includes("reservation_already_exists")) return "reservation-exists";
  if (value.includes("vehicle_reservations_disabled")) return "reservation-disabled";
  if (value.includes("insufficient_stock")) return "stock";
  if (value.includes("vehicle_unavailable")) return "not-found";
  if (value.includes("invalid_purchase_mode")) return "purchase";
  if (value.includes("invalid_delivery_mode")) return "delivery";
  if (value.includes("invalid_delivery_address")) return "address";
  if (value.includes("invalid_delivery_phone")) return "phone";
  return "save";
}

export async function addConfiguredVehicleWithProfileDelivery(
  formData: FormData,
) {
  const vehicleId = integer(formData.get("vehicle_id"));
  const deliveryMode = text(formData.get("delivery_mode"), 30);
  const deliveryAddress = text(formData.get("delivery_address"), 500);
  const deliveryPhone = text(formData.get("delivery_phone"), 40);
  const purchaseMode = text(formData.get("purchase_mode"), 30);

  if (vehicleId <= 0) {
    redirect("/motors/catalogue?cart_error=invalid");
  }

  if (deliveryMode !== "showroom" && deliveryMode !== "home") {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=delivery`);
  }

  if (purchaseMode !== "order" && purchaseMode !== "reservation") {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=purchase`);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data: vehicle, error: vehicleError } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,catalog_type,used_vehicle_status,stock_quantity,published")
    .eq("id", vehicleId)
    .maybeSingle();

  if (vehicleError || !vehicle || vehicle.published !== true) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=not-found`);
  }

  if (
    vehicle.catalog_type === "used" &&
    (vehicle.used_vehicle_status !== "available" ||
      Number(vehicle.stock_quantity ?? 0) <= 0)
  ) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=used-unavailable`);
  }

  if (
    purchaseMode === "reservation" &&
    !(await isVehicleReservationEnabled(
      String(vehicle.catalog_type ?? "standard"),
    ))
  ) {
    redirect(
      `/motors/catalogue/${vehicleId}/commande?error=reservation-disabled`,
    );
  }

  if (deliveryMode === "home" && vehicle.catalog_type === "heavy") {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=heavy-delivery`);
  }

  if (deliveryMode === "home" && deliveryAddress.length < 5) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=address`);
  }

  if (deliveryMode === "home" && deliveryPhone.length < 3) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=phone`);
  }

  const { error } = await supabase.rpc("add_vehicle_purchase_to_cart_v93", {
    p_vehicle_id: vehicleId,
    p_delivery_mode: deliveryMode,
    p_delivery_address: deliveryMode === "home" ? deliveryAddress : null,
    p_delivery_phone: deliveryMode === "home" ? deliveryPhone : null,
    p_purchase_mode: purchaseMode,
  });

  if (error) {
    redirect(
      `/motors/catalogue/${vehicleId}/commande?error=${configuredCartErrorCode(
        error,
      )}`,
    );
  }

  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/vehicules-occasion");
  revalidatePath(`/motors/catalogue/${vehicleId}/commande`);
  revalidatePath("/profil");
  redirect(
    purchaseMode === "reservation"
      ? "/profil?reservation_added=1"
      : "/profil?vehicle_added=1",
  );
}
