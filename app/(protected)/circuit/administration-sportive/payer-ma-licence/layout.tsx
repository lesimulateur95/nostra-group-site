import type { ReactNode } from "react";

import { ServiceClosedNotice } from "@/components/system/service-closed-notice";
import { getServiceAvailability } from "@/lib/system/service-availability";

export default async function ServiceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const service = await getServiceAvailability("circuit_license_payments");

  if (!service.isOpen) {
    return (
      <ServiceClosedNotice
        title="Payer ma licence"
        message={service.closedMessage}
        reopensAt={service.reopensAt}
      />
    );
  }

  return children;
}
