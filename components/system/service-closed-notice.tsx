import Link from "next/link";

import styles from "./service-closed-notice.module.css";

type ServiceClosedNoticeProps = {
  title: string;
  message: string;
};

export function ServiceClosedNotice({
  title,
  message,
}: ServiceClosedNoticeProps) {
  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>NOSTRA CIRCUIT</p>
        <h1>{title}</h1>
        <p>Le service reste consultable, mais les nouvelles opérations sont suspendues.</p>
      </header>

      <section className={styles.notice} role="status">
        <span className={styles.icon} aria-hidden="true">
          ×
        </span>
        <div>
          <p className={styles.status}>SERVICE CLÔTURÉ</p>
          <h2>{message}</h2>
          <p>
            Aucune nouvelle demande et aucun nouveau paiement ne peuvent être
            envoyés tant que la Direction n’a pas rouvert ce service.
          </p>
        </div>
      </section>

      <Link
        className={styles.backLink}
        href="/circuit/administration-sportive"
      >
        ← Retour à l’administration sportive
      </Link>
    </article>
  );
}
