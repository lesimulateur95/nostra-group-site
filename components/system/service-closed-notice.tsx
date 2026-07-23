import Link from "next/link";

import styles from "./service-closed-notice.module.css";

type ServiceClosedNoticeProps = {
  title: string;
  message: string;
  reopensAt?: string | null;
};

function formatReopeningDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function ServiceClosedNotice({
  title,
  message,
  reopensAt = null,
}: ServiceClosedNoticeProps) {
  const reopeningLabel = reopensAt ? formatReopeningDate(reopensAt) : null;

  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>NOSTRA CIRCUIT</p>
        <h1>{title}</h1>
        <p>Le canal reste visible, mais les nouvelles opérations sont suspendues.</p>
      </header>

      <section className={styles.notice} role="status">
        <span className={styles.icon} aria-hidden="true">
          ×
        </span>
        <div>
          <p className={styles.status}>SERVICE CLÔTURÉ</p>
          <h2>{message}</h2>
          {reopeningLabel ? (
            <p>
              <strong>Réouverture prévue :</strong> {reopeningLabel}.
            </p>
          ) : null}
          <p>
            Aucune nouvelle demande et aucun nouveau paiement ne peuvent être
            envoyés tant que la Direction n’a pas rouvert ce service.
          </p>
        </div>
      </section>

      <Link className={styles.backLink} href="/circuit/administration-sportive">
        ← Retour à l’administration sportive
      </Link>
    </article>
  );
}
