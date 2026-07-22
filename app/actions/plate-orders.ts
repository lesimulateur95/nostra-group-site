"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
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

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return supabase;
}

function refreshPlateOrders() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/fidelite");
  revalidatePath("/dashboard/plaques");
  revalidatePath("/motors/plaques");
  revalidatePath("/profil");
}

export async function setPlateOrdersAvailability(
  formData: FormData,
) {
  const basePrice = integer(formData.get("base_price"));
  const active = text(formData.get("active"), 10) === "true";

  if (basePrice < 0) {
    redirect("/dashboard/plaques?error=price");
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
    redirect("/dashboard/plaques?error=availability");
  }

  refreshPlateOrders();
  redirect(
    `/dashboard/plaques?success=${active ? "opened" : "closed"}`,
  );
}

export async function updatePlateOrderStatusFromAdmin(
  formData: FormData,
) {
  const orderId = integer(formData.get("order_id"));
  const status = text(formData.get("status"), 30);
  const allowedStatuses = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ];

  if (orderId <= 0 || !allowedStatuses.includes(status)) {
    redirect("/dashboard/plaques?error=invalid");
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
    redirect("/dashboard/plaques?error=status");
  }

  refreshPlateOrders();
  redirect("/dashboard/plaques?success=status");
}

export async function deletePlateOrder(formData: FormData) {
  const orderId = integer(formData.get("order_id"));

  if (orderId <= 0) {
    redirect("/dashboard/plaques?error=invalid");
  }

  const supabase = await requireManager();
  const { data, error } = await (supabase as any).rpc(
    "nostra_delete_plate_order",
    {
      p_order_id: orderId,
    },
  );

  if (error) {
    redirect("/dashboard/plaques?error=delete");
  }

  if (data !== true) {
    redirect("/dashboard/plaques?error=not_found");
  }

  refreshPlateOrders();
  redirect("/dashboard/plaques?success=deleted");
}
