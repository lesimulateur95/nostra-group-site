import type { ReactNode } from "react";

import { ServiceClosedNotice } from "@/components/system/service-closed-notice";
import { getServiceAvailability } from "@/lib/system/service-availability";

export default async function ServiceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const service = await getServiceAvailability("circuit_vehicle_homologations");

  if (!service.isOpen) {
    return (
      <ServiceClosedNotice
        title="Homologation des véhicules"
        message={service.closedMessage}
      />
    );
  }

  return children;
}
