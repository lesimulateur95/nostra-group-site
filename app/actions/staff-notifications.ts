"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import {
  hasStaffNotificationAccess,
  STAFF_NOTIFICATION_TYPES,
} from "@/lib/notifications/staff-data";
import { createClient } from "@/lib/supabase/server";

function integer(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDashboardTarget(value: unknown): string {
  if (typeof value !== "string") return "/dashboard/notifications";
  if (!value.startsWith("/dashboard") || value.startsWith("//")) {
    return "/dashboard/notifications";
  }
  return value;
}

async function requireNotificationStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!hasStaffNotificationAccess(roles)) redirect("/accueil");

  return { supabase, user: data.user };
}

function refreshStaffNotifications() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

export async function markStaffNotificationRead(formData: FormData) {
  const id = integer(formData.get("id"));
  const { supabase, user } = await requireNotificationStaff();

  if (id > 0) {
    await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .in("notification_type", [...STAFF_NOTIFICATION_TYPES]);
  }

  refreshStaffNotifications();
  redirect("/dashboard/notifications?updated=1");
}

export async function markAllStaffNotificationsRead() {
  const { supabase, user } = await requireNotificationStaff();

  await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("notification_type", [...STAFF_NOTIFICATION_TYPES])
    .is("read_at", null);

  refreshStaffNotifications();
  redirect("/dashboard/notifications?all_read=1");
}

export async function openStaffNotification(formData: FormData) {
  const id = integer(formData.get("id"));
  const { supabase, user } = await requireNotificationStaff();

  if (id <= 0) redirect("/dashboard/notifications");

  const { data } = await supabase
    .from("user_notifications")
    .select("target_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .in("notification_type", [...STAFF_NOTIFICATION_TYPES])
    .maybeSingle();

  await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("notification_type", [...STAFF_NOTIFICATION_TYPES]);

  refreshStaffNotifications();
  redirect(safeDashboardTarget(data?.target_url));
}

export async function deleteStaffNotification(formData: FormData) {
  const id = integer(formData.get("id"));
  const { supabase, user } = await requireNotificationStaff();

  if (id > 0) {
    await supabase
      .from("user_notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .in("notification_type", [...STAFF_NOTIFICATION_TYPES]);
  }

  refreshStaffNotifications();
  redirect("/dashboard/notifications?deleted=1");
}

export async function deleteAllStaffNotifications() {
  const { supabase, user } = await requireNotificationStaff();

  await supabase
    .from("user_notifications")
    .delete()
    .eq("user_id", user.id)
    .in("notification_type", [...STAFF_NOTIFICATION_TYPES]);

  refreshStaffNotifications();
  redirect("/dashboard/notifications?cleared=1");
}
