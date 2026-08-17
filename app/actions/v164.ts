"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import {
  MOTORS_PERMISSION_KEYS,
  MOTORS_ROLE_PERMISSION_PRESETS,
  type MotorsPermissionKey,
} from "@/lib/v164/data";
import { createClient } from "@/lib/supabase/server";

const text = (value: FormDataEntryValue | null, max = 5000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const integer = (value: FormDataEntryValue | null) => {
  const parsed = Number.parseInt(text(value, 50), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: FormDataEntryValue | null) => {
  const parsed = Number(text(value, 80).replace(/\s|€|\$/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};
const bool = (value: FormDataEntryValue | null) =>
  value === "on" || value === "1" || value === "true";

async function current() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  return { supabase, user: data.user };
}

async function manager() {
  const ctx = await current();
  const roles = await getUserRoleKeys(ctx.user);
  if (!roles.includes("manager")) redirect("/dashboard");
  return ctx;
}

async function permission(required: MotorsPermissionKey) {
  const ctx = await current();
  const roles = await getUserRoleKeys(ctx.user);
  if (roles.includes("manager")) return ctx;
  const result = await (ctx.supabase as any).rpc("nostra_v164_has_permission", {
    p_permission: required,
  });
  if (result.error || result.data !== true) redirect("/dashboard");
  return ctx;
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorUserId: string,
  actionKey: string,
  entityType: string,
  entityId: string | number | null,
  title: string,
  details: Record<string, unknown> = {},
) {
  try {
    await (supabase as any).from("motors_employee_audit_v164").insert({
      actor_user_id: actorUserId,
      action_key: actionKey,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      title,
      details,
    });
  } catch {
    // Le métier principal reste fonctionnel si la migration V164 n'est pas complète.
  }
}

function revalidateVehicle(vehicleId?: number) {
  revalidatePath("/profil/garage");
  revalidatePath("/dashboard/garage-vehicules");
  revalidatePath("/dashboard/transferts-vehicules");
  revalidatePath("/dashboard/statistiques-motors");
  revalidatePath("/profil/notifications");
  revalidatePath("/dashboard/notifications");
  if (vehicleId) {
    revalidatePath(`/profil/garage/${vehicleId}`);
    revalidatePath(`/dashboard/garage-vehicules/${vehicleId}`);
  }
}

export async function saveMaintenanceV164(formData: FormData) {
  const { supabase, user } = await permission("maintenance_manage");
  const id = integer(formData.get("id"));
  const vehicleId = integer(formData.get("customer_vehicle_id"));
  if (vehicleId <= 0) redirect("/dashboard/garage-vehicules?error=vehicle");

  const vehicleResult = await (supabase as any)
    .from("customer_vehicles")
    .select("id,user_id,brand,model,vehicle_name,current_mileage")
    .eq("id", vehicleId)
    .maybeSingle();
  if (vehicleResult.error || !vehicleResult.data) {
    redirect(`/dashboard/garage-vehicules/${vehicleId}?error=vehicle`);
  }

  const title = text(formData.get("title"), 180);
  if (!title) redirect(`/dashboard/garage-vehicules/${vehicleId}?error=title`);

  const payload = {
    customer_vehicle_id: vehicleId,
    owner_user_id: String(vehicleResult.data.user_id),
    maintenance_type: text(formData.get("maintenance_type"), 50) || "entretien",
    title,
    service_date: text(formData.get("service_date"), 20) || new Date().toISOString().slice(0, 10),
    mileage: integer(formData.get("mileage")) || null,
    work_done: text(formData.get("work_done"), 5000) || null,
    parts_replaced: text(formData.get("parts_replaced"), 3000) || null,
    vehicle_condition: text(formData.get("vehicle_condition"), 2000) || null,
    staff_comment: text(formData.get("staff_comment"), 5000) || null,
    next_service_date: text(formData.get("next_service_date"), 20) || null,
    next_service_mileage: integer(formData.get("next_service_mileage")) || null,
    cost: money(formData.get("cost")),
    warranty_covered: bool(formData.get("warranty_covered")),
    warranty_contract_id: integer(formData.get("warranty_contract_id")) || null,
    technician_user_id: user.id,
    technician_name: text(formData.get("technician_name"), 180) || null,
    status: text(formData.get("status"), 30) || "completed",
    updated_at: new Date().toISOString(),
  };

  const result = id > 0
    ? await (supabase as any)
        .from("motors_vehicle_maintenance_v164")
        .update(payload)
        .eq("id", id)
        .eq("customer_vehicle_id", vehicleId)
        .select("id")
        .maybeSingle()
    : await (supabase as any)
        .from("motors_vehicle_maintenance_v164")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select("id")
        .single();

  if (result.error) {
    redirect(`/dashboard/garage-vehicules/${vehicleId}?error=maintenance`);
  }

  await audit(
    supabase,
    user.id,
    id > 0 ? "maintenance_updated" : "maintenance_created",
    "customer_vehicle",
    vehicleId,
    id > 0 ? "Carnet d’entretien modifié" : "Entretien ajouté au carnet",
    { maintenance_id: result.data?.id ?? id, title },
  );

  revalidateVehicle(vehicleId);
  redirect(`/dashboard/garage-vehicules/${vehicleId}?maintenance_saved=1`);
}

export async function archiveMaintenanceV164(formData: FormData) {
  const { supabase, user } = await permission("maintenance_manage");
  const id = integer(formData.get("id"));
  const vehicleId = integer(formData.get("customer_vehicle_id"));
  if (id <= 0 || vehicleId <= 0) redirect("/dashboard/garage-vehicules");

  const result = await (supabase as any)
    .from("motors_vehicle_maintenance_v164")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_vehicle_id", vehicleId);
  if (result.error) redirect(`/dashboard/garage-vehicules/${vehicleId}?error=archive`);

  await audit(supabase, user.id, "maintenance_archived", "maintenance", id, "Entrée du carnet archivée", { customer_vehicle_id: vehicleId });
  revalidateVehicle(vehicleId);
  redirect(`/dashboard/garage-vehicules/${vehicleId}?maintenance_archived=1`);
}

export async function createVehicleTransferV164(formData: FormData) {
  const { supabase, user } = await current();
  const vehicleId = integer(formData.get("customer_vehicle_id"));
  const targetUserId = text(formData.get("target_user_id"), 80);
  const transferType = text(formData.get("transfer_type"), 30) || "sale";
  if (vehicleId <= 0 || !targetUserId || targetUserId === user.id) {
    redirect(`/profil/garage/${vehicleId || ""}?transfer_error=invalid`);
  }

  const vehicle = await (supabase as any)
    .from("customer_vehicles")
    .select("id,user_id,garage_status")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .neq("garage_status", "cancelled")
    .maybeSingle();
  if (vehicle.error || !vehicle.data) redirect(`/profil/garage/${vehicleId}?transfer_error=vehicle`);

  const pending = await (supabase as any)
    .from("motors_vehicle_transfers_v164")
    .select("id")
    .eq("customer_vehicle_id", vehicleId)
    .eq("seller_user_id", user.id)
    .eq("status", "pending")
    .limit(1);
  if (Array.isArray(pending.data) && pending.data.length > 0) {
    redirect(`/profil/garage/${vehicleId}?transfer_error=pending`);
  }

  const number = `TR-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const result = await (supabase as any).from("motors_vehicle_transfers_v164").insert({
    transfer_number: number,
    customer_vehicle_id: vehicleId,
    seller_user_id: user.id,
    target_user_id: targetUserId,
    transfer_type: ["sale", "gift", "administrative"].includes(transferType) ? transferType : "sale",
    sale_price: money(formData.get("sale_price")),
    seller_note: text(formData.get("seller_note"), 2500) || null,
  });
  if (result.error) redirect(`/profil/garage/${vehicleId}?transfer_error=save`);

  revalidateVehicle(vehicleId);
  redirect(`/profil/garage/${vehicleId}?transfer_created=1`);
}

export async function cancelVehicleTransferV164(formData: FormData) {
  const { supabase } = await current();
  const id = integer(formData.get("id"));
  const vehicleId = integer(formData.get("customer_vehicle_id"));
  if (id <= 0 || vehicleId <= 0) redirect("/profil/garage");

  const result = await (supabase as any).rpc("nostra_v164_cancel_vehicle_transfer", {
    p_request_id: id,
  });
  if (result.error) redirect(`/profil/garage/${vehicleId}?transfer_error=cancel`);
  revalidateVehicle(vehicleId);
  redirect(`/profil/garage/${vehicleId}?transfer_cancelled=1`);
}

export async function processVehicleTransferV164(formData: FormData) {
  const { supabase } = await permission("transfer_manage");
  const id = integer(formData.get("id"));
  const decision = text(formData.get("decision"), 20);
  const warrantyAction = text(formData.get("warranty_action"), 20) || null;
  const result = await (supabase as any).rpc("nostra_v164_process_vehicle_transfer", {
    p_request_id: id,
    p_decision: decision,
    p_warranty_action: warrantyAction,
    p_staff_note: text(formData.get("staff_note"), 2500) || null,
  });
  if (result.error) redirect(`/dashboard/transferts-vehicules?error=${encodeURIComponent(String(result.error.message || "save"))}`);
  revalidateVehicle();
  redirect(`/dashboard/transferts-vehicules?processed=1`);
}

export async function saveMotorsV164Settings(formData: FormData) {
  const { supabase, user } = await manager();
  const policy = text(formData.get("warranty_transfer_policy"), 20);
  if (!["transfer", "cancel", "manual"].includes(policy)) redirect("/dashboard/transferts-vehicules?error=policy");
  const result = await (supabase as any).from("motors_settings_v164").upsert({
    id: 1,
    warranty_transfer_policy: policy,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (result.error) redirect("/dashboard/transferts-vehicules?error=settings");
  await audit(supabase, user.id, "transfer_policy_updated", "settings", "1", "Règle de transfert Nostra Care modifiée", { policy });
  revalidatePath("/dashboard/transferts-vehicules");
  redirect("/dashboard/transferts-vehicules?settings_saved=1");
}

export async function saveMotorsEmployeeV164(formData: FormData) {
  const { supabase, user } = await manager();
  const userId = text(formData.get("user_id"), 80);
  if (!userId) redirect("/dashboard/employes-motors?error=user");

  const jobRole = text(formData.get("job_role"), 80) || "vendeur";
  const applyRolePreset = formData.get("apply_role_preset") === "on";
  const preset = new Set(MOTORS_ROLE_PERMISSION_PRESETS[jobRole] ?? []);
  const permissions: Record<string, boolean> = {};
  for (const key of MOTORS_PERMISSION_KEYS) {
    permissions[key] = applyRolePreset ? preset.has(key) : formData.get(`perm_${key}`) === "on";
  }

  const payload = {
    user_id: userId,
    job_role: jobRole,
    active: formData.get("active") === "on",
    permissions,
    notes: text(formData.get("notes"), 2500) || null,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const existing = await (supabase as any).from("motors_employees_v164").select("user_id").eq("user_id", userId).maybeSingle();
  const result = await (supabase as any).from("motors_employees_v164").upsert({
    ...payload,
    ...(existing.data ? {} : { created_at: new Date().toISOString(), created_by: user.id }),
  }, { onConflict: "user_id" });
  if (result.error) redirect("/dashboard/employes-motors?error=save");

  // Donne le rôle de base Employé sans retirer les autres rôles du site.
  try {
    const profile = await (supabase as any).from("member_profiles").select("roles,role").eq("user_id", userId).maybeSingle();
    const currentRoles: string[] = Array.isArray(profile.data?.roles) ? profile.data.roles.map(String) : [];
    if (profile.data?.role) currentRoles.push(String(profile.data.role));
    currentRoles.push("citizen", "employee");
    await (supabase as any).rpc("update_member_roles_v114", {
      p_user_id: userId,
      p_roles: [...new Set(currentRoles)],
    });
  } catch {
    // La page Membres reste disponible si l'ancien SQL rôles n'est pas installé.
  }

  await audit(supabase, user.id, existing.data ? "employee_updated" : "employee_created", "motors_employee", userId, existing.data ? "Employé Nostra Motors modifié" : "Employé Nostra Motors ajouté", { job_role: payload.job_role, active: payload.active, permissions });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employes-motors");
  redirect("/dashboard/employes-motors?saved=1");
}

export async function deleteMotorsEmployeeV164(formData: FormData) {
  const { supabase, user } = await manager();
  const userId = text(formData.get("user_id"), 80);
  if (!userId || userId === user.id) redirect("/dashboard/employes-motors?error=delete");

  const result = await (supabase as any).from("motors_employees_v164").delete().eq("user_id", userId);
  if (result.error) redirect("/dashboard/employes-motors?error=delete");
  await audit(supabase, user.id, "employee_removed", "motors_employee", userId, "Employé retiré de Nostra Motors");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employes-motors");
  redirect("/dashboard/employes-motors?deleted=1");
}

function revalidateDemoVehiclesV164() {
  revalidatePath("/dashboard/vehicules-demo");
  revalidatePath("/dashboard/catalogue");
  revalidatePath("/dashboard/statistiques-motors");
  revalidatePath("/motors/catalogue");
  revalidatePath("/motors/catalogue/location");
  revalidatePath("/motors/catalogue/poids-lourds");
  revalidatePath("/motors/catalogue/vehicules-exclusifs");
}

export async function saveDemoVehicleV164(formData: FormData) {
  const { supabase, user } = await permission("catalogue_manage");
  const vehicleId = integer(formData.get("vehicle_id"));
  if (vehicleId <= 0) redirect("/dashboard/vehicules-demo?error=vehicle");

  const vehicle = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,brand,model,is_demo")
    .eq("id", vehicleId)
    .maybeSingle();

  if (vehicle.error || !vehicle.data) {
    redirect("/dashboard/vehicules-demo?error=vehicle");
  }

  const rawOriginalPrice = text(formData.get("demo_original_price"), 80);
  const originalPrice = rawOriginalPrice ? money(formData.get("demo_original_price")) : null;
  const mileage = Math.max(0, integer(formData.get("demo_mileage")));
  const note = text(formData.get("demo_note"), 1200) || null;

  const result = await (supabase as any)
    .from("catalog_vehicles")
    .update({
      is_demo: true,
      demo_mileage: mileage,
      demo_original_price: originalPrice,
      demo_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehicleId);

  if (result.error) {
    redirect(`/dashboard/vehicules-demo?error=${encodeURIComponent(String(result.error.message || "save"))}`);
  }

  await audit(
    supabase,
    user.id,
    vehicle.data.is_demo ? "demo_vehicle_updated" : "demo_vehicle_enabled",
    "catalog_vehicle",
    vehicleId,
    vehicle.data.is_demo
      ? "Véhicule de démonstration modifié"
      : "Véhicule passé en démonstration",
    {
      brand: vehicle.data.brand,
      model: vehicle.data.model,
      demo_mileage: mileage,
      demo_original_price: originalPrice,
      demo_note: note,
    },
  );

  revalidateDemoVehiclesV164();
  redirect("/dashboard/vehicules-demo?saved=1");
}

export async function removeDemoVehicleV164(formData: FormData) {
  const { supabase, user } = await permission("catalogue_manage");
  const vehicleId = integer(formData.get("vehicle_id"));
  if (vehicleId <= 0) redirect("/dashboard/vehicules-demo?error=vehicle");

  const vehicle = await (supabase as any)
    .from("catalog_vehicles")
    .select("id,brand,model,is_demo")
    .eq("id", vehicleId)
    .maybeSingle();

  if (vehicle.error || !vehicle.data) {
    redirect("/dashboard/vehicules-demo?error=vehicle");
  }

  const result = await (supabase as any)
    .from("catalog_vehicles")
    .update({
      is_demo: false,
      demo_mileage: 0,
      demo_original_price: null,
      demo_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehicleId);

  if (result.error) {
    redirect(`/dashboard/vehicules-demo?error=${encodeURIComponent(String(result.error.message || "remove"))}`);
  }

  await audit(
    supabase,
    user.id,
    "demo_vehicle_disabled",
    "catalog_vehicle",
    vehicleId,
    "Statut véhicule de démonstration retiré",
    {
      brand: vehicle.data.brand,
      model: vehicle.data.model,
    },
  );

  revalidateDemoVehiclesV164();
  redirect("/dashboard/vehicules-demo?removed=1");
}
