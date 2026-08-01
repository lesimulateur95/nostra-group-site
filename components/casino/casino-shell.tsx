"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CasinoProfile, CasinoSettings, CasinoWallet } from "@/lib/casino/types";
import styles from "./casino.module.css";

const nav = [
  { href: "/casino", label: "Hall" },
  { href: "/casino/jeux/poker", label: "Poker" },
  { href: "/casino/jeux/roulette", label: "Jeux solo" },
  { href: "/casino/multijoueur", label: "Entre citoyens" },
  { href: "/casino/caisse", label: "La caisse" },
  { href: "/casino/profil", label: "Mon cercle" },
];

function chips(value: number): string {
  return Math.trunc(value).toLocaleString("fr-FR");
}

export function CasinoShell({
  children,
  profile,
  settings,
  wallet,
  privateMode,
}: {
  children: React.ReactNode;
  profile: CasinoProfile;
  settings: CasinoSettings;
  wallet: CasinoWallet | null;
  privateMode: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.casinoRoot}>
      <div className={styles.ambientOne} aria-hidden="true" />
      <div className={styles.ambientTwo} aria-hidden="true" />
      <header className={styles.header}>
        <Link className={styles.brand} href="/casino">
          <span className={styles.brandMark}>N</span>
          <span>
            <small>MAISON PRIVÉE</small>
            <strong>{settings.name}</strong>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Navigation du casino">
          {nav.map((item) => {
            const active = item.href === "/casino"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link className={active ? styles.navActive : ""} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.accountBox}>
          {privateMode && <span className={styles.privateBadge}>MODE MASQUÉ</span>}
          <Link className={styles.balancePill} href="/casino/caisse">
            <span className={styles.chipIcon}>◉</span>
            <span>
              <small>SOLDE</small>
              <strong>{wallet ? chips(wallet.balance) : "—"} jetons</strong>
            </span>
          </Link>
          <Link className={styles.avatarLink} href="/casino/profil" aria-label="Ouvrir le profil casino">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" />
            ) : (
              <span>{profile.displayName.slice(0, 2).toUpperCase()}</span>
            )}
          </Link>
        </div>
      </header>

      {!settings.configured && (
        <div className={styles.setupBanner}>
          Le casino est en prévisualisation. Exécute le SQL V108 pour activer les jetons et les parties.
        </div>
      )}

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <span>{settings.name} · Universe Life</span>
        <span>Jeux exclusivement en monnaie virtuelle RP · 18+</span>
        <Link href="/accueil">Retour à Nostra Group</Link>
      </footer>
    </div>
  );
}
