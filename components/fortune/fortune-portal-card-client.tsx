"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./fortune.module.css";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function FortunePortalCardClient({
  jackpot,
  status,
}: {
  jackpot: number;
  status: string | null;
}) {
  const pathname = usePathname();
  if (pathname.includes("/evenements/roue-de-la-fortune")) return null;

  const label =
    status === "active"
      ? "Partie en cours"
      : status === "finale"
        ? "Manche finale"
        : "Ouvrir le jeu";

  return (
    <section className={styles.portalSection}>
      <Link className={styles.portalCard} href="/evenements/roue-de-la-fortune">
        <span className={styles.portalIcon}>🎡</span>
        <span className={styles.portalCopy}>
          <span className={styles.eyebrow}>JEU EN DIRECT</span>
          <strong>La Roue de la Fortune</strong>
          <span>Trois joueurs, quatre manches, énigmes et jackpot persistant.</span>
        </span>
        <span className={styles.portalStatus}>
          <strong>{label}</strong>
          <small>Jackpot : {money(jackpot)}</small>
        </span>
      </Link>
    </section>
  );
}
