import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import {
  canManageServiceAvailability,
  getServiceAvailabilities,
} from "@/lib/system/service-availability";

export default async function PilotLicensesDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [services, canManage] = await Promise.all([
    getServiceAvailabilities(["circuit_license_payments"]),
    canManageServiceAvailability(),
  ]);

  return (
    <>
      <ServiceAvailabilityPanel
        title="Paiement des licences"
        description="Le canal public reste visible. Lorsqu’il est clôturé, le formulaire disparaît et les paiements déjà présents dans un panier sont aussi bloqués."
        services={services}
        canManage={canManage}
      />
      {children}
    </>
  );
}
