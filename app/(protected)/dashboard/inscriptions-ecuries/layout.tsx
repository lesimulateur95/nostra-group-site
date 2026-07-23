import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import {
  canManageServiceAvailability,
  getServiceAvailabilities,
} from "@/lib/system/service-availability";

export default async function TeamRegistrationsDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [services, canManage] = await Promise.all([
    getServiceAvailabilities(["circuit_team_creation"]),
    canManageServiceAvailability(),
  ]);

  return (
    <>
      <ServiceAvailabilityPanel
        title="Création d’écurie"
        description="La page publique reste visible pendant une clôture, mais aucune nouvelle création d’écurie ne peut être envoyée."
        services={services}
        canManage={canManage}
      />
      {children}
    </>
  );
}
