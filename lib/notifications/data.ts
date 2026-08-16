import { createClient } from "@/lib/supabase/server";

export const DISPLAYED_NOTIFICATION_TYPES = [
  "order",
  "event",
  "championship",
  "homologation",
  "team",
  "reservation",
  "invoice",
  "loyalty",
  "general",
  "mail",
  "appointment",
  "ticket",
  "contract",
  "promo",
  "casino",
  "maintenance",
  "academy",
] as const;

export type UserNotification = {
  id: number;
  user_id: string;
  notification_type:
    | "order"
    | "event"
    | "championship"
    | "homologation"
    | "team"
    | "reservation"
    | "invoice"
    | "loyalty"
    | "general"
    | "mail"
    | "appointment"
    | "ticket"
    | "contract"
    | "promo"
    | "casino"
    | "maintenance"
    | "academy";
  title: string;
  message: string;
  target_url: string | null;
  source_type: string | null;
  source_id: string | null;
  read_at: string | null;
  priority: "normal" | "high" | "urgent" | string;
  category: string;
  archived_at: string | null;
  created_at: string;
};

async function refreshLicenceExpiryNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  try {
    await (supabase as any).rpc("refresh_my_license_expiry_notifications");
  } catch {
    // Le centre de notifications reste utilisable avant l'installation du SQL V59.
  }
  try {
    await (supabase as any).rpc("nostra_v164_refresh_my_vehicle_notifications");
  } catch {
    // Compatibilité avant l'installation de la V164.
  }
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const supabase = await createClient();
  await refreshLicenceExpiryNotifications(supabase);

  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("notification_type", [...DISPLAYED_NOTIFICATION_TYPES])
    .is("archived_at", null)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

export async function getOwnNotifications(
  userId: string,
  unreadOnly = false,
): Promise<{
  configured: boolean;
  notifications: UserNotification[];
}> {
  const supabase = await createClient();
  await refreshLicenceExpiryNotifications(supabase);

  let query = supabase
    .from("user_notifications")
    .select(
      "id,user_id,notification_type,title,message,target_url,source_type,source_id,read_at,priority,category,archived_at,created_at",
    )
    .eq("user_id", userId)
    .in("notification_type", [...DISPLAYED_NOTIFICATION_TYPES])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;

  return {
    configured: !error,
    notifications: (data ?? []) as UserNotification[],
  };
}

export async function getArchivedNotifications(userId: string): Promise<UserNotification[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("user_notifications")
    .select("id,user_id,notification_type,title,message,target_url,source_type,source_id,read_at,priority,category,archived_at,created_at")
    .eq("user_id", userId)
    .in("notification_type", [...DISPLAYED_NOTIFICATION_TYPES])
    .not("archived_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  return error ? [] : (data ?? []) as UserNotification[];
}
