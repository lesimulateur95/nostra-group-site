import Link from "next/link";

import { getNostraEnvironment } from "@/lib/system/environment";

import styles from "./environment-banner.module.css";

export function EnvironmentBanner() {
  const environment =
    getNostraEnvironment();

  if (
    environment.isProduction &&
    !environment.hasEnvironmentMismatch
  ) {
    return null;
  }

  return (
    <aside
      className={`${styles.banner} ${
        environment.hasEnvironmentMismatch
          ? styles.danger
          : styles.preview
      }`}
      aria-live="polite"
    >
      <div className={styles.copy}>
        <strong>
          {environment.hasEnvironmentMismatch
            ? "ERREUR DE CONFIGURATION"
            : `${environment.label} — SITE DE TEST`}
        </strong>

        <span>
          {environment.hasEnvironmentMismatch
            ? "L’environnement du site et celui de la base de données ne correspondent pas."
            : "Les changements visibles ici ne doivent pas être considérés comme publiés sur le site officiel."}
        </span>
      </div>

      <div className={styles.meta}>
        <span>
          Branche : {environment.branch}
        </span>
        <span>
          Version : {environment.shortCommitSha}
        </span>

        <Link href="/dashboard/systeme">
          Contrôle système →
        </Link>
      </div>
    </aside>
  );
}
