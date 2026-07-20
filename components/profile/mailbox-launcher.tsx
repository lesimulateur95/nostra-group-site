
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./mailbox-launcher.module.css";

type CountResponse = {
  unread: number;
};

export function MailboxLauncher({
  address,
  configured,
  initialUnreadCount,
}: {
  address: string | null;
  configured: boolean;
  initialUnreadCount: number;
}) {
  const [unread, setUnread] = useState(initialUnreadCount);

  useEffect(() => {
    if (!configured) return;

    let active = true;

    const refreshCount = async () => {
      try {
        const response = await fetch("/api/mail/count", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const data = (await response.json()) as CountResponse;
        if (active && Number.isFinite(data.unread)) {
          setUnread(Math.max(0, data.unread));
        }
      } catch {
        // Une coupure momentanée ne doit pas bloquer le profil.
      }
    };

    const timer = window.setInterval(refreshCount, 5_000);
    void refreshCount();

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [configured]);

  return (
    <section className={styles.card} aria-label="Boîte mail Nostra Group">
      <div className={styles.icon} aria-hidden="true">
        ✉️
      </div>

      <div className={styles.content}>
        <span className={styles.eyebrow}>MESSAGERIE INTERNE</span>
        <h2>Ma boîte mail Nostra Group</h2>

        {configured && address ? (
          <>
            <strong className={styles.address}>{address}</strong>
            <p>
              Écris directement à l’équipe Nostra Group et reçois ses réponses
              dans ton espace privé.
            </p>
          </>
        ) : (
          <p>
            La messagerie sera disponible après l’activation du module V35.
          </p>
        )}
      </div>

      <Link
        aria-disabled={!configured}
        className={`${styles.button} ${!configured ? styles.disabled : ""}`}
        href={configured ? "/profil/messagerie" : "/profil"}
      >
        <span>Ouvrir ma boîte mail</span>
        {configured && unread > 0 && (
          <strong className={styles.badge}>
            {unread > 99 ? "99+" : unread}
          </strong>
        )}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
