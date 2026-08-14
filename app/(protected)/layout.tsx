import { Suspense } from "react";
import { redirect } from "next/navigation";

import { StaffNotificationLoader } from "@/components/notifications/staff-notification-loader";
import { DeletionReasonGuard } from "@/components/security/deletion-reason-guard";
import { getRequestUser } from "@/lib/auth/request-context";
import { GlobalAnnouncementV155 } from "@/components/v155/global-announcement";
import { getAnnouncementsV155 } from "@/lib/v155/data";
import { GlobalCountdownV156 } from "@/components/v156/global-countdown-v156";
import { PresenceHeartbeatV156 } from "@/components/v156/presence-heartbeat";
import { getGlobalCountdownV156 } from "@/lib/v156/data";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, announcements, countdown] = await Promise.all([
    getRequestUser(),
    getAnnouncementsV155(false),
    getGlobalCountdownV156(),
  ]);

  if (!user) redirect("/");

  return (
    <>
      <PresenceHeartbeatV156 />
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
