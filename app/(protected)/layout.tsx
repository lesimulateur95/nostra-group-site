import { Suspense } from "react";
import { redirect } from "next/navigation";

import { StaffNotificationLoader } from "@/components/notifications/staff-notification-loader";
import { DeletionReasonGuard } from "@/components/security/deletion-reason-guard";
import { getRequestUser } from "@/lib/auth/request-context";
import { GlobalAnnouncementV155 } from "@/components/v155/global-announcement";
import { getAnnouncementsV155 } from "@/lib/v155/data";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, announcements] = await Promise.all([getRequestUser(), getAnnouncementsV155(false)]);

  if (!user) redirect("/");

  return (
    <>
      <GlobalAnnouncementV155 announcement={announcements[0] ?? null} />
      {children}
      <Suspense fallback={null}>
        <StaffNotificationLoader />
      </Suspense>
      <DeletionReasonGuard />
    </>
  );
}
