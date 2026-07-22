import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SecurityAdministrationPanel } from "@/components/security/security-administration-panel";
import { getSecurityOverview } from "@/lib/security/data";

import styles from "./page.module.css";

export default async function SecurityAdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const params = await searchParams;
  const overview = await getSecurityOverview();

  return (
    <DashboardShell allowedRoles={["manager", "commercial", "employee", "commissioner", "citizen"]}>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <span>DASHBOARD · SITE ET MEMBRES</span>
            <h1>Sécurité & administration</h1>
            <p>
              Contrôle les accès par rôle, le mode maintenance, les comptes bloqués,
              les sauvegardes, la corbeille et tous les journaux de sécurité.
            </p>
          </div>
          <Link href="/dashboard" className={styles.back}>← Retour au Dashboard</Link>
        </header>

        {!overview.configured || !overview.data ? (
          <section className={styles.activation}>
            <span>ACTIVATION SUPABASE REQUISE</span>
            <h2>Le centre de sécurité n’est pas encore activé</h2>
            <p>
              Exécute d’abord la migration Supabase V64, puis recharge cette page avec Ctrl + F5.
            </p>
            <code>20260722_v64_security_administration.sql</code>
            {overview.error && <small>{overview.error}</small>}
          </section>
        ) : (
          <SecurityAdministrationPanel
            overview={overview.data}
            initialTab={params.onglet}
          />
        )}
      </div>
    </DashboardShell>
  );
}
