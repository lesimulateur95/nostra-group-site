"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
  const value =
    `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  if (
    value.includes("pgrst202") ||
    value.includes("add_configured_vehicle_to_cart") ||
    value.includes("item_type") ||
    value.includes("related_vehicle_id") ||
    value.includes("delivery_phone") ||
    value.includes("delivery_address")
  ) {
    return "setup";
  }

  if (value.includes("insufficient_stock")) return "stock";
  if (value.includes("vehicle_unavailable")) return "not-found";
  if (value.includes("invalid_delivery_mode")) return "delivery";
  if (value.includes("invalid_delivery_address")) return "address";

  return "save";
}

export async function addConfiguredVehicleWithProfileDelivery(
  formData: FormData,
) {
  const vehicleId = integer(formData.get("vehicle_id"));
  const deliveryMode = text(formData.get("delivery_mode"), 30);
  const deliveryAddress = text(formData.get("delivery_address"), 500);
  const deliveryPhone = text(formData.get("delivery_phone"), 40);

  if (vehicleId <= 0) {
    redirect("/motors/catalogue?cart_error=invalid");
  }

  if (deliveryMode !== "showroom" && deliveryMode !== "home") {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=delivery`);
  }

  if (deliveryMode === "home" && deliveryAddress.length < 5) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=address`);
  }

  if (deliveryMode === "home" && deliveryPhone.length < 3) {
    redirect(`/motors/catalogue/${vehicleId}/commande?error=phone`);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const { error } = await supabase.rpc("add_configured_vehicle_to_cart", {
    p_vehicle_id: vehicleId,
    p_delivery_mode: deliveryMode,
    p_delivery_address: deliveryMode === "home" ? deliveryAddress : null,
  });

  if (error) {
    redirect(
      `/motors/catalogue/${vehicleId}/commande?error=${configuredCartErrorCode(error)}`,
    );
  }

  if (deliveryMode === "home") {
    const deliveryUpdate = await supabase
      .from("cart_items")
      .update({
        delivery_address: deliveryAddress,
        delivery_phone: deliveryPhone,
      })
      .eq("user_id", authData.user.id)
      .eq("item_type", "delivery")
      .eq("related_vehicle_id", vehicleId)
      .select("id")
      .maybeSingle();

    if (deliveryUpdate.error || !deliveryUpdate.data) {
      redirect(`/motors/catalogue/${vehicleId}/commande?error=setup`);
    }
  }

  revalidatePath("/motors/catalogue");
  revalidatePath(`/motors/catalogue/${vehicleId}/commande`);
  revalidatePath("/profil");

  redirect("/profil?vehicle_added=1");
}
