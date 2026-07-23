import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import {
  canManageServiceAvailability,
  getServiceAvailabilities,
  getServiceAvailabilityHistory,
} from "@/lib/system/service-availability";

export default async function CircuitDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [services, canManage, history] = await Promise.all([
    getServiceAvailabilities([
      "circuit_services_master",
      "circuit_license_payments",
      "circuit_vehicle_homologations",
      "circuit_team_homologations",
      "circuit_team_creation",
    ]),
    canManageServiceAvailability(),
    getServiceAvailabilityHistory(20),
  ]);

  return (
    <>
      <ServiceAvailabilityPanel
        title="Ouverture des services Nostra Circuit"
        description="La fermeture générale suspend tout en un clic sans effacer les réglages individuels. Chaque service conserve aussi son propre message, sa date prévue de réouverture et son interrupteur."
        services={services}
        canManage={canManage}
        history={canManage ? history : undefined}
      />
      {children}
    </>
  );
}
