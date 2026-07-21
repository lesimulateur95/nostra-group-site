"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getDiscordName,
  getRpName,
} from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

function text(
  value: FormDataEntryValue | null,
  max = 500,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 50), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorCode(error: {
  message?: string | null;
  code?: string | null;
} | null): string {
  const value = `${error?.code ?? ""} ${
    error?.message ?? ""
  }`.toLowerCase();

  if (value.includes("manager_required")) return "manager";
  if (value.includes("invalid_tier")) return "tier";
  if (value.includes("invalid_plate")) return "plate";
  if (value.includes("invalid_vehicle")) return "vehicle";
  if (value.includes("plate_orders_closed")) return "closed";
  if (value.includes("empty_plate_cart")) return "empty";
  if (value.includes("invalid_price")) return "price";

  return "save";
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return supabase;
}

function refreshLoyalty() {
  revalidatePath("/profil");
  revalidatePath("/motors/fidelite");
  revalidatePath("/motors/plaques");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/fidelite");
}

export async function saveLoyaltyPreference(
  formData: FormData,
) {
  const kind = text(formData.get("kind"), 20);
  const enabled = text(formData.get("enabled"), 10) === "true";

  if (!["catalog", "plate"].includes(kind)) {
    redirect("/profil?loyalty_error=preference");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { error } = await (supabase as any).rpc(
    "nostra_set_loyalty_preference",
    {
      p_kind: kind,
      p_enabled: enabled,
    },
  );

  if (error) {
    redirect(
      `/profil?loyalty_error=${errorCode(error)}`,
    );
  }

  refreshLoyalty();
  redirect("/profil?loyalty_saved=1");
}

export async function addPlateToCart(formData: FormData) {
  const plateText = text(formData.get("plate_text"), 16);
  const vehicleLabel = text(
    formData.get("vehicle_label"),
    120,
  );
  const notes = text(formData.get("notes"), 1000) || null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { error } = await (supabase as any).rpc(
    "nostra_add_plate_to_cart",
    {
      p_plate_text: plateText,
      p_vehicle_label: vehicleLabel,
      p_notes: notes,
    },
  );

  if (error) {
    redirect(
      `/motors/plaques?error=${errorCode(error)}`,
    );
  }

  refreshLoyalty();
  redirect("/profil?plate_added=1");
}

export async function removePlateCart() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { error } = await (supabase as any).rpc(
    "nostra_remove_plate_cart",
  );

  if (error) redirect("/profil?plate_error=remove");

  refreshLoyalty();
  redirect("/profil?plate_removed=1");
}

export async function checkoutPlateOrder() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const customerName =
    getRpName(data.user) ||
    getDiscordName(data.user) ||
    "Client Nostra Motors";

  const { data: result, error } = await (supabase as any).rpc(
    "nostra_checkout_plate_order",
    {
      p_customer_name: customerName,
    },
  );

  if (error) {
    redirect(
      `/profil?plate_error=${errorCode(error)}`,
    );
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const orderNumber =
    typeof response.order_number === "string"
      ? response.order_number
      : "Nostra Motors";

  refreshLoyalty();
  redirect(
    `/profil?plate_order_sent=${encodeURIComponent(
      orderNumber,
    )}`,
  );
}

export async function assignLoyaltyTier(
  formData: FormData,
) {
  const userId = text(formData.get("user_id"), 80);
  const tierCode = text(formData.get("tier_code"), 50);

  if (!userId || !tierCode) {
    redirect("/dashboard/fidelite?error=invalid");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "nostra_assign_loyalty_tier",
    {
      p_user_id: userId,
      p_tier_code: tierCode,
    },
  );

  if (error) {
    redirect(
      `/dashboard/fidelite?error=${errorCode(error)}`,
    );
  }

  refreshLoyalty();
  redirect("/dashboard/fidelite?success=assigned");
}

export async function removeLoyaltyTier(
  formData: FormData,
) {
  const userId = text(formData.get("user_id"), 80);

  if (!userId) {
    redirect("/dashboard/fidelite?error=invalid");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "nostra_remove_loyalty_tier",
    {
      p_user_id: userId,
    },
  );

  if (error) {
    redirect(
      `/dashboard/fidelite?error=${errorCode(error)}`,
    );
  }

  refreshLoyalty();
  redirect("/dashboard/fidelite?success=removed");
}

export async function updatePlateSettings(
  formData: FormData,
) {
  const basePrice = integer(formData.get("base_price"));
  const active = text(formData.get("active"), 10) === "true";

  if (basePrice < 0) {
    redirect("/dashboard/fidelite?error=price");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "nostra_update_plate_settings",
    {
      p_base_price: basePrice,
      p_active: active,
    },
  );

  if (error) {
    redirect(
      `/dashboard/fidelite?error=${errorCode(error)}`,
    );
  }

  refreshLoyalty();
  redirect("/dashboard/fidelite?success=settings");
}

export async function updatePlateOrderStatus(
  formData: FormData,
) {
  const orderId = integer(formData.get("order_id"));
  const status = text(formData.get("status"), 30);

  if (
    orderId <= 0 ||
    ![
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "completed",
      "cancelled",
    ].includes(status)
  ) {
    redirect("/dashboard/fidelite?error=invalid");
  }

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc(
    "nostra_update_plate_order_status",
    {
      p_order_id: orderId,
      p_status: status,
    },
  );

  if (error) {
    redirect(
      `/dashboard/fidelite?error=${errorCode(error)}`,
    );
  }

  refreshLoyalty();
  redirect("/dashboard/fidelite?success=order");
}
