import { Suspense } from "react";
import { redirect } from "next/navigation";

import { StaffNotificationLoader } from "@/components/notifications/staff-notification-loader";
import { DeletionReasonGuard } from "@/components/security/deletion-reason-guard";
import { getRequestUser } from "@/lib/auth/request-context";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getRequestUser();

  if (!user) redirect("/");

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <StaffNotificationLoader />
      </Suspense>
      <DeletionReasonGuard />
    </>
  );
}
