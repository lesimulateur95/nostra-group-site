
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
  "mail",
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
    | "mail";
  title: string;
  message: string;
  target_url: string | null;
  source_type: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("notification_type", [...DISPLAYED_NOTIFICATION_TYPES])
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

  let query = supabase
    .from("user_notifications")
    .select(
      "id,user_id,notification_type,title,message,target_url,source_type,source_id,read_at,created_at",
    )
    .eq("user_id", userId)
    .in("notification_type", [...DISPLAYED_NOTIFICATION_TYPES])
    .order("created_at", { ascending: false })
    .limit(200);

  if (unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;

  return {
    configured: !error,
    notifications: (data ?? []) as UserNotification[],
  };
}
