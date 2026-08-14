import { Suspense } from "react";
import { redirect } from "next/navigation";

import { StaffNotificationLoader } from "@/components/notifications/staff-notification-loader";
import { DeletionReasonGuard } from "@/components/security/deletion-reason-guard";
import { getRequestUser } from "@/lib/auth/request-context";
import { GlobalAnnouncementV155 } from "@/components/v155/global-announcement";
import { GlobalTemporaryBannersV155 } from "@/components/v155/global-temporary-banners";
import { getAnnouncementsV155, getBannersV155 } from "@/lib/v155/data";
import { GlobalCountdownV156 } from "@/components/v156/global-countdown-v156";
import { PresenceHeartbeatV156 } from "@/components/v156/presence-heartbeat";
import { getGlobalCountdownV156 } from "@/lib/v156/data";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, banners, announcements, countdown] = await Promise.all([
    getRequestUser(),
    getBannersV155(false),
    getAnnouncementsV155(false),
    getGlobalCountdownV156(),
  ]);

  if (!user) redirect("/");

  return (
    <>
      <PresenceHeartbeatV156 />
      <GlobalTemporaryBannersV155 banners={banners} />
      <GlobalAnnouncementV155 announcement={announcements[0] ?? null} />
      <GlobalCountdownV156 countdown={countdown} />
      {children}
      <Suspense fallback={null}>
        <StaffNotificationLoader />
      </Suspense>
      <DeletionReasonGuard />
    </>
  );
}
