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
}: {
  amount: number;
  status: string | null;
  round: number | null;
  totalRounds: number;
}) {
  const pathname = usePathname();
  if (pathname.includes("/motors/money-drop")) return null;

  const statusLabel =
    status === "question_open"
      ? "Répartition en cours"
      : status === "allocations_locked"
        ? "Mises verrouillées"
        : status === "revealed"
          ? "Résultat révélé"
          : status === "finished"
            ? "Partie terminée"
            : "Ouvrir le jeu";

  return (
    <section className={styles.portalSection}>
      <Link className={styles.portalCard} href="/motors/money-drop">
        <span className={styles.portalIcon}>💸</span>
        <span className={styles.portalCopy}>
          <span className={styles.eyebrow}>NOSTRA MOTORS — JEU EN DIRECT</span>
          <strong>Money Drop</strong>
          <span>
            Répartissez la cagnotte sur les trappes et gardez l’argent posé sur la bonne réponse.
          </span>
        </span>
        <span className={styles.portalStatus}>
          <strong>{statusLabel}</strong>
          <small>
            {money(amount)}
            {round ? ` · Manche ${round}/${totalRounds}` : ""}
          </small>
        </span>
      </Link>
    </section>
  );
}
