import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import { getServiceAvailabilities } from "@/lib/system/service-availability";

export default async function PilotLicensesDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const services = await getServiceAvailabilities([
    "circuit_license_payments",
  ]);

  return (
    <>
      <ServiceAvailabilityPanel
        title="Paiement des licences"
        description="Le canal public reste visible. Lorsqu’il est clôturé, le formulaire disparaît et un message de fermeture est affiché. Les paiements déjà présents dans un panier sont également bloqués."
        services={services}
      />
      {children}
    </>
  );
}
