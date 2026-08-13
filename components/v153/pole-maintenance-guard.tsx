import type { ReactNode } from "react";
import Link from "next/link";

import { getRequestRoleKeys } from "@/lib/auth/request-context";
import { getMaintenancePoleV153, type MaintenancePoleKey } from "@/lib/v153/data";
import styles from "./v153.module.css";

export async function PoleMaintenanceGuard({ pole, children }: { pole: MaintenancePoleKey; children: ReactNode }) {
  const [roles, maintenance] = await Promise.all([getRequestRoleKeys(), getMaintenancePoleV153(pole)]);
  const manager = roles.includes("manager");
  if (!maintenance?.enabled || manager) return <>{children}</>;
  return (
    <div className={styles.maintenance}>
      <section className={styles.maintenanceCard}>
        <p className={styles.eyebrow}>NOSTRA GROUP · MAINTENANCE</p>
        <h1>{maintenance.title}</h1>
        <p>{maintenance.message}</p>
        {maintenance.etaText && <p><strong>Retour estimé :</strong> {maintenance.etaText}</p>}
        <Link className={styles.buttonAlt} href="/accueil">← Retour à l’accueil</Link>
      </section>
    </div>
  );
}
