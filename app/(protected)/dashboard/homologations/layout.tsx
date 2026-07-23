import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import { getServiceAvailabilities } from "@/lib/system/service-availability";

export default async function HomologationsDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const services = await getServiceAvailabilities([
    "circuit_vehicle_homologations",
    "circuit_team_homologations",
  ]);

  return (
    <>
      <ServiceAvailabilityPanel
        title="Demandes d’homologation"
        description="Les homologations véhicules et écuries peuvent être ouvertes ou clôturées indépendamment, sans masquer leurs pages publiques."
        services={services}
      />
      {children}
    </>
  );
}
