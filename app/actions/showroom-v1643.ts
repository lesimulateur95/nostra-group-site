"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { canMotorsV164, getMotorsEmployeeAccessV164 } from "@/lib/v164/data";

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: FormDataEntryValue | null): number | null {
  const raw = typeof value === "string" ? value.trim().replace(",", ".") : "";
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function text(value: FormDataEntryValue | null, max = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function checked(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "true" || value === "on";
}

async function requireShowroomAccess() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const manager = roles.includes("manager");
  const legacyStaff = roles.some((role) => ["employee", "commercial"].includes(role));
  const access = await getMotorsEmployeeAccessV164(data.user.id, manager);

  const allowed =
    manager ||
    canMotorsV164(access, "inventory_manage", legacyStaff) ||
    canMotorsV164(access, "catalogue_manage", false);

  if (!allowed) redirect("/dashboard");
  return { supabase, user: data.user };
}

function revalidateShowroom() {
  [
    "/dashboard/showroom",
    "/dashboard/vehicules-demo",
    "/dashboard/catalogue",
    "/dashboard/stock-reel",
    "/motors/showroom",
    "/motors/catalogue",
    "/motors/catalogue/location",
    "/motors/catalogue/poids-lourds",
    "/motors/catalogue/vehicules-exclusifs",
    "/aujourdhui",
  ].forEach((path) => revalidatePath(path));
}

function errorCode(message: string | undefined): string {
  const value = String(message ?? "").toLowerCase();
  if (value.includes("exceeds_available")) return "quantity";
  if (value.includes("below_demo")) return "demo";
  if (value.includes("not_in_showroom")) return "showroom";
  if (value.includes("not_found")) return "not-found";
  if (value.includes("forbidden")) return "forbidden";
  if (value.includes("does not exist") || value.includes("function")) return "setup";
  return "save";
}

export async function setShowroomQuantityV1643(formData: FormData) {
  const { supabase, user } = await requireShowroomAccess();
  const vehicleId = integer(formData.get("vehicle_id"));
  const quantity = Math.max(0, integer(formData.get("showroom_quantity")));
  if (vehicleId <= 0) redirect("/dashboard/showroom?error=invalid");

  const { error } = await (supabase as any).rpc("nostra_set_showroom_quantity_v1643", {
    p_vehicle_id: vehicleId,
    p_quantity: quantity,
  });

  if (error) {
    redirect(`/dashboard/showroom?error=${errorCode(error.message)}#vehicule-${vehicleId}`);
  }

  try {
    await (supabase as any).from("motors_employee_audit_v164").insert({
      actor_user_id: user.id,
      action_key: "showroom_quantity_updated",
      entity_type: "catalog_vehicle",
      entity_id: String(vehicleId),
      title: "Affectation showroom modifiée",
      details: { showroom_quantity: quantity },
    });
  } catch {}

  revalidateShowroom();
  redirect(`/dashboard/showroom?saved=showroom#vehicule-${vehicleId}`);
}

export async function saveDemoUnitV1643(formData: FormData) {
  const { supabase, user } = await requireShowroomAccess();
  const unitId = integer(formData.get("unit_id"));
  const vehicleId = integer(formData.get("vehicle_id"));
  const isDemo = checked(formData.get("is_demo"));
  const mileage = Math.max(0, integer(formData.get("demo_mileage")));
  const originalPrice = money(formData.get("demo_original_price"));
  const note = text(formData.get("demo_note"));

  if (unitId <= 0 || vehicleId <= 0) redirect("/dashboard/showroom?error=invalid");

  const { error } = await (supabase as any).rpc("nostra_set_demo_unit_v1643", {
    p_unit_id: unitId,
    p_is_demo: isDemo,
    p_mileage: mileage,
    p_original_price: originalPrice,
    p_note: note || null,
  });

  if (error) {
    redirect(`/dashboard/showroom?error=${errorCode(error.message)}#vehicule-${vehicleId}`);
  }

  try {
    await (supabase as any).from("motors_employee_audit_v164").insert({
      actor_user_id: user.id,
      action_key: isDemo ? "showroom_demo_enabled" : "showroom_demo_disabled",
      entity_type: "physical_vehicle_unit",
      entity_id: String(unitId),
      title: isDemo ? "Exemplaire passé en démonstration" : "Statut démonstration retiré",
      details: { vehicle_id: vehicleId, mileage, original_price: originalPrice, note },
    });
  } catch {}

  revalidateShowroom();
  redirect(`/dashboard/showroom?saved=demo#vehicule-${vehicleId}`);
}
