import type { ReactNode } from "react";

import { ServiceClosedNotice } from "@/components/system/service-closed-notice";
import { getServiceAvailability } from "@/lib/system/service-availability";

export default async function ServiceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const service = await getServiceAvailability("circuit_team_homologations");

  if (!service.isOpen) {
    return (
      <ServiceClosedNotice
        title="Homologation des écuries"
        message={service.closedMessage}
        reopensAt={service.reopensAt}
      />
    );
  }

  return children;
}
