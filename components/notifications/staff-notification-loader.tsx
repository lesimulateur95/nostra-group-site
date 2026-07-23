import { StaffNotificationCenter } from "@/components/notifications/staff-notification-center";
import { getRequestRoleKeys } from "@/lib/auth/request-context";
import { hasStaffNotificationAccess } from "@/lib/notifications/staff-data";

/**
 * Charge les notifications du personnel dans une boundary Suspense afin de ne
 * plus bloquer l'affichage initial de toutes les pages protégées.
 */
export async function StaffNotificationLoader() {
  const roles = await getRequestRoleKeys();

  if (!hasStaffNotificationAccess(roles)) {
    return null;
  }

  return <StaffNotificationCenter />;
}
