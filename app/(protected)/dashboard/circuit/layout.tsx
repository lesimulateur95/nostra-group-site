import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import { getServiceAvailabilities } from "@/lib/system/service-availability";

export default async function CircuitDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const services = await getServiceAvailabilities([
    "circuit_license_payments",
    "circuit_vehicle_homologations",
    "circuit_team_homologations",
    "circuit_team_creation",
  ]);

  return (
    <>
      <ServiceAvailabilityPanel
        title="Ouverture des services Nostra Circuit"
        description="Active ou clôture séparément le paiement des licences, les homologations de véhicules, les homologations d’écuries et la création d’écuries. Les pages publiques restent visibles lorsqu’un service est clôturé."
        services={services}
      />
      {children}
    </>
  );
}
