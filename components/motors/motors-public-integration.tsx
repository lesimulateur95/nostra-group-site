"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CatalogVehicleV41 } from "@/lib/nostra-motors/v41-shared";
import { PopularVehicles } from "./popular-vehicles";
import { VehicleComparator } from "./vehicle-comparator";
import styles from "./v41.module.css";

export function MotorsPublicNavigation() {
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isAppointment = normalizedPath === "/nostra-motors/rendez-vous";

  return (
    <nav className={styles.publicToolsNav} aria-label="Navigation Nostra Motors">
      <Link href="/nostra-motors">Accueil Nostra Motors</Link>
      <Link href="/nostra-motors/catalogue">Catalogue</Link>
      <Link
        className={isAppointment ? styles.publicToolsNavActive : styles.publicToolsNavImportant}
        href="/nostra-motors/rendez-vous"
      >
        Prendre rendez-vous
      </Link>
    </nav>
  );
}

type EnhancementsProps = {
  vehicles: CatalogVehicleV41[];
};

export function MotorsPublicEnhancements({ vehicles }: EnhancementsProps) {
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isMotorsHome = normalizedPath === "/nostra-motors";
  const isCatalogue = normalizedPath === "/nostra-motors/catalogue";

  if (!isMotorsHome && !isCatalogue) return null;

  return (
    <section className={styles.publicIntegrationBlock}>
      {isMotorsHome && (
        <>
          <article className={styles.appointmentCallout}>
            <div>
              <span className={styles.eyebrow}>SHOWROOM & ESSAIS</span>
              <h2>Réserve ton rendez-vous chez Nostra Motors</h2>
              <p className={styles.muted}>
                Choisis une visite du showroom ou demande l’essai d’un véhicule du catalogue.
              </p>
            </div>
            <Link className={styles.button} href="/nostra-motors/rendez-vous">
              Prendre rendez-vous
            </Link>
          </article>
          <PopularVehicles vehicles={vehicles} limit={3} />
        </>
      )}

      {isCatalogue && (
        <div id="comparateur-vehicules">
          <VehicleComparator vehicles={vehicles} />
        </div>
      )}
    </section>
  );
}
