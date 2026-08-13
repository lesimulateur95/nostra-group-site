/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isVehicleReservationEnabled } from "@/lib/vehicle-reservation-settings/data";
import { getVehicleCommerceAvailability } from "@/lib/vehicle-commerce-settings/data";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";

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
    value.includes("submit_vehicle_financing_v125") ||
    value.includes("reservation_id") ||
    value.includes("original_unit_price") ||
    value.includes("delivery_phone")
  ) {
    return "setup";
  }

  if (value.includes("heavy_home_delivery_disabled")) return "heavy-delivery";
  if (value.includes("used_vehicle_unavailable")) return "used-unavailable";
  if (value.includes("reservation_already_exists")) return "reservation-exists";
  if (value.includes("vehicle_reservation_disabled")) return "reservation-vehicle-disabled";
  if (value.includes("vehicle_reservations_disabled")) return "reservation-disabled";
  if (value.includes("vehicle_sale_disabled")) return "sale-disabled";
  if (value.includes("financing_disabled")) return "financing-disabled";
  if (value.includes("financing_term_disabled")) return "financing-term";
  if (value.includes("financing_minimum_price")) return "financing-minimum";
  if (value.includes("financing_already_exists")) return "financing-exists";
  if (value.includes("steam_identity_required")) return "financing-steam";
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
  const profilePhone = text(formData.get("profile_phone"), 40);
  const purchaseMode = text(formData.get("purchase_mode"), 30);
  const financingNote = text(formData.get("financing_note"), 1500);

  if (vehicleId <= 0) {
    redirect("/motors/catalogue?cart_error=invalid");
  }

  if (deliveryMode !== "showroom" && deliveryMode !== "home") {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=delivery`);
  }

  const financingTerm =
    purchaseMode === "financing_3"
      ? 3
      : purchaseMode === "financing_4"
        ? 4
        : null;
  if (
    purchaseMode !== "order" &&
    purchaseMode !== "reservation" &&
    financingTerm === null
  ) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=purchase`);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data: vehicle, error: vehicleError } = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,catalog_type,used_vehicle_status,stock_quantity,published,price")
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

  const isRentalCatalog = vehicle.catalog_type === "concession";

  if (
    isRentalCatalog &&
    (purchaseMode !== "order" || deliveryMode !== "showroom" || financingTerm !== null)
  ) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=rental-mode`);
  }

  const [catalogReservationEnabled, vehicleAvailability] = await Promise.all([
    isVehicleReservationEnabled(String(vehicle.catalog_type ?? "standard")),
    getVehicleCommerceAvailability(vehicleId),
  ]);

  if (purchaseMode === "reservation" && !catalogReservationEnabled) {
    redirect(
      `/motors/catalogue/${vehicleId}/commande?error=reservation-disabled`,
    );
  }

  if (
    purchaseMode === "reservation" &&
    !vehicleAvailability.reservation_enabled
  ) {
    redirect(
      `/motors/catalogue/${vehicleId}/commande?error=reservation-vehicle-disabled`,
    );
  }

  if ((purchaseMode === "order" || financingTerm) && !vehicleAvailability.sale_enabled) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=sale-disabled`);
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

  if (financingTerm) {
    const customerName =
      getRpName(authData.user) ||
      getDiscordName(authData.user) ||
      "Client Nostra Motors";
    const { data: result, error } = await (supabase as any).rpc(
      "submit_vehicle_financing_v125",
      {
        p_vehicle_id: vehicleId,
        p_term_count: financingTerm,
        p_delivery_mode: deliveryMode,
        p_delivery_address: deliveryMode === "home" ? deliveryAddress : null,
        p_delivery_phone:
          deliveryMode === "home" ? deliveryPhone : profilePhone || null,
        p_customer_name: customerName,
        p_customer_phone: deliveryPhone || profilePhone || null,
        p_customer_note: financingNote || null,
      },
    );

    if (error) {
      redirect(
        `/motors/catalogue/${vehicleId}/commande?error=${configuredCartErrorCode(
          error,
        )}`,
      );
    }

    const response =
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : {};
    revalidatePath("/profil/financements");
    revalidatePath("/dashboard/financements-vehicules");
    redirect(
      `/profil/financements?submitted=${encodeURIComponent(
        String(response.application_number ?? "1"),
      )}`,
    );
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
