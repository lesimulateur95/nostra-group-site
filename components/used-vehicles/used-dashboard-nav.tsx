import Link from "next/link";

import styles from "./used-vehicles.module.css";

const ITEMS = [
  ["Catalogue", "/dashboard/occasion/catalogue"],
  ["Stock", "/dashboard/occasion/stocks"],
  ["Rachats", "/dashboard/occasion/rachats"],
  ["Mandats de recherche", "/dashboard/occasion/mandats-recherche"],
  ["Dépôts-vente", "/dashboard/occasion/depots-vente"],
  ["Commandes", "/dashboard/occasion/commandes"],
  ["Ventes", "/dashboard/occasion/ventes"],
  ["Clients", "/dashboard/occasion/clients"],
  ["Documents", "/dashboard/occasion/documents"],
  ["Statistiques", "/dashboard/occasion/statistiques"],
] as const;

export function UsedVehicleDashboardNav({ current }: { current: string }) {
  return (
    <nav className={styles.nav} aria-label="Gestion des véhicules rachetés">
      {ITEMS.map(([label, href]) => (
        <Link
          href={href}
          className={current === href ? styles.navActive : styles.navLink}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
