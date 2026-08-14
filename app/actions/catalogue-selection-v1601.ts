/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getVehicleCommerceAvailability } from "@/lib/vehicle-commerce-settings/data";
import {
  canCitizenAccessVehicleTierV157,
  getCurrentCitizenVehicleTierV157,
  getVehicleMerchandisingV157,
} from "@/lib/v157/data";

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseVehicleIds(value: FormDataEntryValue | null): number[] {
  const raw = text(value, 12000);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((item) => Number.parseInt(String(item), 10))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ].slice(0, 50);
  } catch {
    return [];
  }
}

function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = text(value, 300);
  return path.startsWith("/motors/catalogue")
    ? path
    : "/motors/catalogue";
}

function fail(path: string, code: string): never {
  redirect(`${path}?selection_error=${encodeURIComponent(code)}`);
}

function rpcErrorCode(
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
    value.includes("nostra_add_vehicle_selection_to_cart_v1601") ||
    value.includes("nostra_add_vehicle_selection_to_cart_v161") ||
    value.includes("nostra_prepare_cart_delivery_v160") ||
    value.includes("add_vehicle_purchase_to_cart_v93")
  ) {
    return "setup";
  }
  if (value.includes("insufficient_stock")) return "stock";
  if (value.includes("used_vehicle_unavailable")) return "used";
  if (value.includes("vehicle_unavailable")) return "unavailable";
  if (value.includes("vehicle_sale_disabled")) return "sale";
  if (value.includes("loyalty_tier_required")) return "tier";
  if (value.includes("private_sale_required")) return "vip";
  if (value.includes("rental_selection_disabled")) return "rental";
  if (value.includes("invalid_delivery_mode")) return "delivery";
  if (value.includes("invalid_delivery_address")) return "address";
  if (value.includes("invalid_delivery_phone")) return "phone";
  if (value.includes("selection_empty")) return "empty";
  if (value.includes("vehicle_temporarily_reserved")) return "held";
  if (value.includes("hold_limit_reached")) return "limit";
  return "save";
}

function revalidateSelectionPaths() {
  revalidatePath("/profil");
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
  revalidatePath("/motors/catalogue/vehicules-occasion");
  revalidatePath("/motors/catalogue/poids-lourds");
}

export async function addVehicleSelectionToCartV1601(formData: FormData) {
  const vehicleIds = parseVehicleIds(formData.get("vehicle_ids"));
  const deliveryMode = text(formData.get("delivery_mode"), 30);
  const deliveryAddress = text(formData.get("delivery_address"), 500);
  const deliveryPhone = text(formData.get("delivery_phone"), 40);
  const returnPath = safeReturnPath(formData.get("return_path"));

  if (vehicleIds.length === 0) fail(returnPath, "empty");
  if (!['showroom', 'home'].includes(deliveryMode)) fail(returnPath, "delivery");
  if (deliveryMode === "home" && deliveryAddress.length < 5) {
    fail(returnPath, "address");
  }
  if (deliveryMode === "home" && deliveryPhone.length < 3) {
    fail(returnPath, "phone");
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data: vehicles, error: vehicleError } = await (supabase as any)
    .from("catalog_vehicles")
    .select(
      "id,catalog_type,published,stock_quantity,used_vehicle_status,brand,model",
    )
    .in("id", vehicleIds);

  if (vehicleError || !Array.isArray(vehicles)) fail(returnPath, "unavailable");
  if (vehicles.length !== vehicleIds.length) fail(returnPath, "unavailable");

  const vehicleById = new Map<number, any>(
    vehicles.map((vehicle: any) => [Number(vehicle.id), vehicle]),
  );
  const citizenTier = await getCurrentCitizenVehicleTierV157(authData.user.id);

  const checks = await Promise.all(
    vehicleIds.map(async (vehicleId) => {
      const vehicle = vehicleById.get(vehicleId);
      if (!vehicle || vehicle.published !== true) return "unavailable";
      if (String(vehicle.catalog_type ?? "standard") === "concession") {
        return "rental";
      }
      if (Number(vehicle.stock_quantity ?? 0) <= 0) return "stock";
      if (
        String(vehicle.catalog_type ?? "standard") === "used" &&
        String(vehicle.used_vehicle_status ?? "available") !== "available"
      ) {
        return "used";
      }

      const [availability, merchandising] = await Promise.all([
        getVehicleCommerceAvailability(vehicleId),
        getVehicleMerchandisingV157(vehicleId),
      ]);
      if (!availability.sale_enabled) return "sale";
      if (
        merchandising.requiredTier !== "all" &&
        !canCitizenAccessVehicleTierV157(
          merchandising.requiredTier,
          citizenTier,
        )
      ) {
        return "tier";
      }
      return null;
    }),
  );

  const firstCheckError = checks.find((code) => code !== null);
  if (firstCheckError) fail(returnPath, firstCheckError);

  // Les ventes privées V155 restent protégées même pour une sélection groupée.
  const { data: privateSales, error: privateSaleError } = await (supabase as any)
    .from("nostra_private_sales_v155")
    .select("vehicle_id,min_loyalty_points,starts_at,ends_at,enabled")
    .in("vehicle_id", vehicleIds)
    .eq("enabled", true);

  if (!privateSaleError && Array.isArray(privateSales) && privateSales.length > 0) {
    const now = Date.now();
    const activePrivateSales = privateSales.filter((row: any) =>
      (!row.starts_at || new Date(row.starts_at).getTime() <= now) &&
      (!row.ends_at || new Date(row.ends_at).getTime() >= now),
    );
    if (activePrivateSales.length > 0) {
      const { data: loyaltyPoints } = await (supabase as any).rpc(
        "nostra_loyalty_points_v155",
        { p_user_id: authData.user.id },
      );
      const points = Number(loyaltyPoints ?? 0);
      if (
        activePrivateSales.some(
          (row: any) => points < Number(row.min_loyalty_points ?? 0),
        )
      ) {
        fail(returnPath, "vip");
      }
    }
  }

  const { data: result, error } = await (supabase as any).rpc(
    "nostra_add_vehicle_selection_to_cart_v161",
    {
      p_vehicle_ids: vehicleIds,
      p_delivery_mode: deliveryMode,
      p_delivery_address: deliveryMode === "home" ? deliveryAddress : null,
      p_delivery_phone: deliveryMode === "home" ? deliveryPhone : null,
    },
  );

  if (error) fail(returnPath, rpcErrorCode(error));

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const rawAddedCount = Number(response.added_count);
  const addedCount = Number.isFinite(rawAddedCount)
    ? Math.max(0, rawAddedCount)
    : vehicleIds.length;

  revalidateSelectionPaths();
  redirect(`/profil?vehicle_added=${addedCount}&selection_added=1`);
}
