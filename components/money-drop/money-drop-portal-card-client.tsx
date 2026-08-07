"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./money-drop.module.css";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function MoneyDropPortalCardClient({
  amount,
  status,
  round,
  totalRounds,
  registrationsOpen,
}: {
  amount: number;
  status: string | null;
  round: number | null;
  totalRounds: number;
  registrationsOpen: boolean;
}) {
  const pathname = usePathname();
  if (pathname.includes("/evenements/jeux/money-drop")) return null;

  const statusLabel =
    status === "setup"
      ? "ÉQUIPE EN PRÉPARATION"
      : status === "question_open"
      ? "PARTIE EN DIRECT"
      : status === "allocations_locked"
        ? "RÉVÉLATION EN COURS"
        : status === "revealed"
          ? "RÉSULTAT DE MANCHE"
          : status === "finished"
            ? "PARTIE TERMINÉE"
            : registrationsOpen
              ? "INSCRIPTIONS OUVERTES"
              : "PROCHAINE ÉMISSION";

  return (
    <section className={styles.portalSection}>
      <article className={styles.portalCard}>
        <div className={styles.portalIcon}>€</div>
        <div className={styles.portalCopy}>
          <span className={styles.eyebrow}>JEUX & ÉVÉNEMENTS · MONEY DROP</span>
          <strong>Money Drop</strong>
          <span>Une cagnotte, quatre trappes et une seule bonne réponse. Sauve le maximum avant la finale.</span>
        </div>
        <div className={styles.portalStatus}>
          <strong>{statusLabel}</strong>
          <small>{money(amount)}{round ? ` · Manche ${round}/${totalRounds}` : ""}</small>
          <div className={styles.portalActions}>
            <Link className={styles.primaryButton} href="/evenements/jeux/money-drop">Ouvrir le jeu</Link>
            {registrationsOpen && <Link className={styles.secondaryButton} href="/evenements/jeux/money-drop/inscription">S’inscrire</Link>}
          </div>
        </div>
      </article>
    </section>
  );
}
