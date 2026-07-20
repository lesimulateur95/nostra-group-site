
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { openNotification } from "@/app/actions/notifications";
import styles from "./global-notification-popup.module.css";

type PopupNotification = {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  target_url: string | null;
  created_at: string;
};

type LatestResponse = {
  configured: boolean;
  unread: number;
  notifications: PopupNotification[];
};

const icons: Record<string, string> = {
  order: "🚗",
  event: "📅",
  championship: "🏁",
  homologation: "📋",
  team: "🏎️",
  reservation: "🗓️",
  invoice: "🧾",
  loyalty: "◆",
  mail: "✉️",
  general: "🔔",
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function GlobalNotificationPopup() {
  const [configured, setConfigured] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<
    PopupNotification[]
  >([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<PopupNotification | null>(
    null,
  );
  const initialized = useRef(false);
  const latestKnownId = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let requestInProgress = false;
    let toastTimer: number | null = null;

    const refresh = async () => {
      if (
        requestInProgress ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      requestInProgress = true;

      try {
        const response = await fetch("/api/notifications/latest", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;

        const data = (await response.json()) as LatestResponse;
        if (!active) return;

        setConfigured(data.configured);
        setUnread(Math.max(0, data.unread));
        setNotifications(data.notifications);

        const newest = data.notifications[0] ?? null;

        if (!initialized.current) {
          initialized.current = true;
          latestKnownId.current = newest?.id ?? null;
          return;
        }

        if (
          newest &&
          latestKnownId.current !== null &&
          newest.id !== latestKnownId.current
        ) {
          setToast(newest);

          if (toastTimer !== null) {
            window.clearTimeout(toastTimer);
          }

          toastTimer = window.setTimeout(() => {
            setToast(null);
          }, 7_000);
        }

        latestKnownId.current = newest?.id ?? latestKnownId.current;
      } catch {
        // Le reste du site reste utilisable en cas de coupure momentanée.
      } finally {
        requestInProgress = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 12_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
      if (toastTimer !== null) {
        window.clearTimeout(toastTimer);
      }
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  if (!configured) return null;

  return (
    <div className={styles.wrapper}>
      {toast && !open && (
        <section className={styles.toast} aria-live="polite">
          <span className={styles.toastIcon}>
            {icons[toast.notification_type] ?? "🔔"}
          </span>
          <div className={styles.toastBody}>
            <span className={styles.toastEyebrow}>
              NOUVELLE NOTIFICATION
            </span>
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <form action={openNotification}>
            <input type="hidden" name="id" value={toast.id} />
            <button
              aria-label="Ouvrir la notification"
              className={styles.toastOpen}
              type="submit"
            >
              →
            </button>
          </form>
          <button
            aria-label="Fermer"
            className={styles.toastClose}
            type="button"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </section>
      )}

      <button
        aria-expanded={open}
        aria-label="Ouvrir les notifications"
        className={`${styles.bell} ${
          unread > 0 ? styles.bellUnread : ""
        }`}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setToast(null);
        }}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <strong>{unread > 99 ? "99+" : unread}</strong>
        )}
      </button>

      {open && (
        <>
          <button
            aria-label="Fermer les notifications"
            className={styles.backdrop}
            type="button"
            onClick={() => setOpen(false)}
          />

          <aside className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <span>ESPACE PERSONNEL</span>
                <h2>Notifications</h2>
              </div>
              <button
                aria-label="Fermer"
                type="button"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className={styles.panelSummary}>
              <strong>{unread}</strong>
              <span>
                notification{unread > 1 ? "s" : ""} non lue
                {unread > 1 ? "s" : ""}
              </span>
            </div>

            <div className={styles.list}>
              {notifications.length === 0 && (
                <div className={styles.empty}>
                  <span>✓</span>
                  <strong>Tout est à jour</strong>
                  <p>Tu n’as aucune notification non lue.</p>
                </div>
              )}

              {notifications.map((notification) => (
                <article
                  className={styles.item}
                  key={notification.id}
                >
                  <span className={styles.itemIcon}>
                    {icons[notification.notification_type] ?? "🔔"}
                  </span>
                  <div className={styles.itemBody}>
                    <div className={styles.itemHeading}>
                      <strong>{notification.title}</strong>
                      <time dateTime={notification.created_at}>
                        {formatTime(notification.created_at)}
                      </time>
                    </div>
                    <p>{notification.message}</p>
                  </div>
                  <form action={openNotification}>
                    <input
                      type="hidden"
                      name="id"
                      value={notification.id}
                    />
                    <button
                      aria-label={`Ouvrir : ${notification.title}`}
                      className={styles.itemOpen}
                      type="submit"
                    >
                      →
                    </button>
                  </form>
                </article>
              ))}
            </div>

            <Link
              className={styles.allLink}
              href="/profil/notifications"
              onClick={() => setOpen(false)}
            >
              Voir toutes mes notifications
              <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </>
      )}
    </div>
  );
}
