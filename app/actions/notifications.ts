
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function integer(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  return { supabase, user: data.user };
}

function safeInternalTarget(value: unknown): string {
  if (typeof value !== "string") return "/profil/notifications";
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/profil/notifications";
  }
  return value;
}

export async function markNotificationRead(formData: FormData) {
  const id = integer(formData.get("id"));
  const { supabase, user } = await requireUser();

  if (id > 0) {
    await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
  }

  revalidatePath("/profil");
  revalidatePath("/profil/notifications");
  redirect("/profil/notifications?updated=1");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();

  await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  revalidatePath("/profil");
  revalidatePath("/profil/notifications");
  redirect("/profil/notifications?all_read=1");
}

export async function openNotification(formData: FormData) {
  const id = integer(formData.get("id"));
  const { supabase, user } = await requireUser();

  if (id <= 0) redirect("/profil/notifications");

  const { data } = await supabase
    .from("user_notifications")
    .select("target_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/profil");
  revalidatePath("/profil/notifications");
  redirect(safeInternalTarget(data?.target_url));
}

export async function deleteNotification(formData: FormData) {
  const id = integer(formData.get("id"));
  const { supabase, user } = await requireUser();

  if (id > 0) {
    await supabase
      .from("user_notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
  }

  revalidatePath("/profil");
  revalidatePath("/profil/notifications");
  redirect("/profil/notifications?deleted=1");
}

export async function deleteAllNotifications() {
  const { supabase, user } = await requireUser();

  await supabase
    .from("user_notifications")
    .delete()
    .eq("user_id", user.id);

  revalidatePath("/profil");
  revalidatePath("/profil/notifications");
  redirect("/profil/notifications?cleared=1");
}
