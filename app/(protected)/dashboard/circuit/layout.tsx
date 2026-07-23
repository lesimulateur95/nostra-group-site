import type { ReactNode } from "react";

import { ServiceAvailabilityPanel } from "@/components/dashboard/service-availability-panel";
import {
  canManageServiceAvailability,
  getServiceAvailabilities,
  getServiceAvailabilityHistory,
} from "@/lib/system/service-availability";

import styles from "./layout.module.css";

export default async function CircuitDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [services, canManage, history] = await Promise.all([
    getServiceAvailabilities([
      "circuit_services_master",
      "circuit_license_pilot",
      "circuit_license_gt3rs",
      "circuit_license_f1",
      "circuit_vehicle_homologations",
      "circuit_team_homologations",
      "circuit_team_creation",
    ]),
    canManageServiceAvailability(),
    getServiceAvailabilityHistory(20),
  ]);

  const closedServices = services.filter(
    (service) => !service.configuredOpen,
  ).length;

  return (
    <>
      {children}

      <section className={styles.wrapper} aria-label="Gestion des blocages Nostra Circuit">
        <details className={styles.details}>
          <summary className={styles.summary}>
            <div className={styles.summaryText}>
              <span>GESTION DES SERVICES</span>
              <strong>Blocages et ouvertures Nostra Circuit</strong>
              <small>
                Chaque licence possède maintenant son propre bouton : licence
                pilote, licence GT3RS et licence F1. Les homologations et la
                création d’écurie restent également indépendantes.
              </small>
            </div>

            <div className={styles.summaryAction}>
              {closedServices > 0 ? (
                <span className={styles.closedBadge}>
                  {closedServices} clôturé{closedServices > 1 ? "s" : ""}
                </span>
              ) : (
                <span className={styles.openBadge}>Tous ouverts</span>
              )}
              <span className={styles.openLabel}>Afficher les réglages</span>
              <span className={styles.chevron} aria-hidden="true">
                ↓
              </span>
            </div>
          </summary>

          <div className={styles.content}>
            <ServiceAvailabilityPanel
              title="Ouverture des services Nostra Circuit"
              description="La fermeture générale suspend tout en un clic sans effacer les réglages individuels. La licence pilote, la licence GT3RS, la licence F1, les homologations véhicules, les homologations d’écuries et la création d’écurie disposent chacune de leur propre bouton, message et date de réouverture."
              services={services}
              canManage={canManage}
              history={canManage ? history : undefined}
            />
          </div>
        </details>
      </section>
    </>
  );
}
