import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import { getServiceAvailabilities } from "@/lib/system/service-availability";

export default async function TeamRegistrationsDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const services = await getServiceAvailabilities([
    "circuit_team_creation",
  ]);

  return (
    <>
      <ServiceAvailabilityPanel
        title="Création d’écurie"
        description="La page publique reste visible pendant une clôture, mais aucune nouvelle création d’écurie ne peut être envoyée."
        services={services}
      />
      {children}
    </>
  );
}
