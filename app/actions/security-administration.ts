"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { SECURITY_ROLE_OPTIONS, type SecurityRoleKey } from "@/lib/security/types";

async function getDirectionClient() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Connexion requise");

  const { data, error } = await supabase.rpc("nostra_security_is_direction", {
    p_user_id: authData.user.id,
  });
  if (error || !data) throw new Error("Accès réservé à la Direction");
  return supabase;
}

function requiredText(formData: FormData, key: string, minimum = 1) {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length < minimum) throw new Error(`Le champ ${key} est obligatoire`);
  return value;
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function refreshSecurity() {
  revalidatePath("/dashboard/securite");
  revalidatePath("/dashboard");
}

export async function updateSecuritySettingsAction(formData: FormData) {
  const supabase = await getDirectionClient();
  const { error } = await supabase.rpc("nostra_update_security_settings", {
    p_maintenance_enabled: formData.get("maintenance_enabled") === "on",
    p_maintenance_message: String(formData.get("maintenance_message") ?? ""),
    p_require_delete_reason: formData.get("require_delete_reason") === "on",
    p_backup_interval_hours: numberValue(formData, "backup_interval_hours", 24),
    p_trash_retention_days: numberValue(formData, "trash_retention_days", 30),
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function savePageAccessAction(formData: FormData) {
  const supabase = await getDirectionClient();
  const allowed = SECURITY_ROLE_OPTIONS
    .map((role) => role.key)
    .filter((role): role is SecurityRoleKey => formData.get(`role_${role}`) === "on");

  const rawId = String(formData.get("id") ?? "").trim();
  const { error } = await supabase.rpc("nostra_upsert_page_access", {
    p_id: rawId || null,
    p_label: requiredText(formData, "label"),
    p_category: requiredText(formData, "category"),
    p_path_pattern: requiredText(formData, "path_pattern"),
    p_allowed_roles: allowed,
    p_active: formData.get("active") === "on",
    p_sort_order: numberValue(formData, "sort_order", 100),
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function blockAccountAction(formData: FormData) {
  const supabase = await getDirectionClient();
  const userId = requiredText(formData, "user_id");
  const duration = numberValue(formData, "duration_hours", 24);
  const until = new Date(Date.now() + Math.max(1, duration) * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.rpc("nostra_block_account", {
    p_user_id: userId,
    p_blocked_until: until,
    p_reason: requiredText(formData, "reason", 4),
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function unblockAccountAction(formData: FormData) {
  const supabase = await getDirectionClient();
  const { error } = await supabase.rpc("nostra_unblock_account", {
    p_user_id: requiredText(formData, "user_id"),
    p_reason: requiredText(formData, "reason", 4),
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function setDirectionAccessAction(formData: FormData) {
  const supabase = await getDirectionClient();
  const { error } = await supabase.rpc("nostra_set_direction_access", {
    p_user_id: requiredText(formData, "user_id"),
    p_enabled: formData.get("enabled") === "true",
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function createBackupAction() {
  const supabase = await getDirectionClient();
  const { error } = await supabase.rpc("nostra_create_site_backup", {
    p_kind: "manuel",
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function refreshSecurityTriggersAction() {
  const supabase = await getDirectionClient();
  const { error } = await supabase.rpc("nostra_refresh_security_triggers");
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function restoreTrashItemAction(formData: FormData) {
  const supabase = await getDirectionClient();
  const { error } = await supabase.rpc("nostra_restore_trash_item", {
    p_id: requiredText(formData, "id"),
    p_reason: requiredText(formData, "reason", 4),
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}

export async function permanentlyDeleteTrashItemAction(formData: FormData) {
  const supabase = await getDirectionClient();
  const { error } = await supabase.rpc("nostra_permanently_delete_trash_item", {
    p_id: requiredText(formData, "id"),
    p_reason: requiredText(formData, "reason", 4),
  });
  if (error) throw new Error(error.message);
  refreshSecurity();
}
