import { createClient } from "@/lib/supabase/server";

export const STAFF_NOTIFICATION_TYPES = [
  "staff_order_new",
  "staff_order_status",
  "staff_appointment",
  "staff_sav_reply",
  "staff_application",
  "staff_licence",
  "staff_document",
  "staff_plate_order",
  "staff_auction",
  "staff_delivery",
] as const;

export type StaffNotificationType =
  (typeof STAFF_NOTIFICATION_TYPES)[number];

export type StaffNotification = {
  id: number;
  user_id: string;
  notification_type: StaffNotificationType;
  title: string;
  message: string;
  target_url: string | null;
  source_type: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
};

export function hasStaffNotificationAccess(roles: string[]): boolean {
  return roles.some((role) =>
    ["manager", "commercial", "employee"].includes(role),
  );
}

export async function getStaffNotifications(
  userId: string,
  unreadOnly = false,
): Promise<{
  configured: boolean;
  notifications: StaffNotification[];
}> {
  const supabase = await createClient();

  let query = supabase
    .from("user_notifications")
    .select(
      "id,user_id,notification_type,title,message,target_url,source_type,source_id,read_at,created_at",
    )
    .eq("user_id", userId)
    .in("notification_type", [...STAFF_NOTIFICATION_TYPES])
    .order("created_at", { ascending: false })
    .limit(250);

  if (unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;

  return {
    configured: !error,
    notifications: (data ?? []) as StaffNotification[],
  };
}

export async function getStaffUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("notification_type", [...STAFF_NOTIFICATION_TYPES])
    .is("read_at", null);

  return error ? 0 : count ?? 0;
}
