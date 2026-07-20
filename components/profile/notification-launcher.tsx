
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./notification-launcher.module.css";

type CountResponse = {
  unread: number;
};

export function NotificationLauncher({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const [unread, setUnread] = useState(initialUnreadCount);

  useEffect(() => {
    let active = true;

    const refreshCount = async () => {
      try {
        const response = await fetch("/api/notifications/count", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const data = (await response.json()) as CountResponse;
        if (active && Number.isFinite(data.unread)) {
          setUnread(Math.max(0, data.unread));
        }
      } catch {
        // Une coupure momentanée ne doit pas gêner le reste du profil.
      }
    };

    const timer = window.setInterval(refreshCount, 5_000);
    void refreshCount();

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className={styles.card} aria-label="Centre de notifications">
      <div className={styles.icon} aria-hidden="true">
        🔔
      </div>

      <div className={styles.content}>
        <span className={styles.eyebrow}>CENTRE PERSONNEL</span>
        <h2>Notifications</h2>
        <p>
          Commandes, événements, championnats, homologations et autres
          informations importantes.
        </p>
      </div>

      <Link className={styles.button} href="/profil/notifications">
        <span>Ouvrir les notifications</span>
        {unread > 0 && (
          <strong className={styles.badge}>
            {unread > 99 ? "99+" : unread}
          </strong>
        )}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
