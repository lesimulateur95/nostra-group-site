import Link from "next/link";

import styles from "./page.module.css";

function formatDate(value: string | undefined) {
  if (!value) return "une date définie par la Direction";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(date);
}

export default async function BlockedAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; until?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.icon}>🔒</div>
        <span>SÉCURITÉ NOSTRA GROUP</span>
        <h1>Compte temporairement bloqué</h1>
        <p>Ton accès est suspendu jusqu’au <strong>{formatDate(params.until)}</strong>.</p>
        <div className={styles.reason}>
          <small>Motif communiqué par la Direction</small>
          <strong>{params.reason ?? "Blocage administratif temporaire"}</strong>
        </div>
        <p className={styles.note}>Pour contester ou obtenir une précision, contacte la Direction via les moyens habituels du serveur.</p>
        <Link href="/">Vérifier à nouveau</Link>
      </section>
    </main>
  );
}
