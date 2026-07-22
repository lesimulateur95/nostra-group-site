import { redirect } from "next/navigation";

import { StaffNotificationCenter } from "@/components/notifications/staff-notification-center";
import { getUserRoleKeys } from "@/lib/auth/access";
import { hasStaffNotificationAccess } from "@/lib/notifications/staff-data";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const showStaffNotifications = hasStaffNotificationAccess(roles);

  return (
    <>
      {children}
      {showStaffNotifications && <StaffNotificationCenter />}
    </>
  );
}
