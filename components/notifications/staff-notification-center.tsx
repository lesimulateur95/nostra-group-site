"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { openStaffNotification } from "@/app/actions/staff-notifications";

import styles from "./staff-notification-center.module.css";

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
  staff_order_new: "🛒",
  staff_order_status: "📦",
  staff_appointment: "📅",
  staff_sav_reply: "🛠️",
  staff_application: "📋",
  staff_licence: "🪪",
  staff_document: "📄",
  staff_plate_order: "🔶",
  staff_auction: "🔨",
  staff_delivery: "🚚",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function StaffNotificationCenter() {
  const [configured, setConfigured] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<PopupNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<PopupNotification | null>(null);
  const initialized = useRef(false);
  const latestKnownId = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let requestInProgress = false;
    let toastTimer: number | null = null;

    const refresh = async () => {
      if (requestInProgress || document.visibilityState !== "visible") return;

      requestInProgress = true;

      try {
        const response = await fetch("/api/staff-notifications/latest", {
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

          if (toastTimer !== null) window.clearTimeout(toastTimer);
          toastTimer = window.setTimeout(() => setToast(null), 7_000);
        }

        latestKnownId.current = newest?.id ?? latestKnownId.current;
      } catch {
        // Une coupure de notifications ne bloque jamais le reste du site.
      } finally {
        requestInProgress = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh();
    const interval = window.setInterval(refresh, 30_000);

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (toastTimer !== null) window.clearTimeout(toastTimer);
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
        <div className={styles.toast} role="status">
          <span className={styles.toastIcon} aria-hidden="true">
            {icons[toast.notification_type] ?? "🔔"}
          </span>
          <div className={styles.toastBody}>
            <span className={styles.toastEyebrow}>NOUVELLE NOTIFICATION</span>
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <form action={openStaffNotification}>
            <input type="hidden" name="id" value={toast.id} />
            <button className={styles.toastOpen} type="submit" aria-label="Ouvrir">
              →
            </button>
          </form>
          <button
            className={styles.toastClose}
            type="button"
            aria-label="Fermer"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      <button
        className={`${styles.bell} ${unread > 0 ? styles.bellUnread : ""}`}
        type="button"
        aria-label="Ouvrir les notifications de l'équipe"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setToast(null);
        }}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <strong>{unread > 99 ? "99+" : unread}</strong>}
      </button>

      {open && (
        <>
          <button
            className={styles.backdrop}
            type="button"
            aria-label="Fermer les notifications"
            onClick={() => setOpen(false)}
          />
          <section className={styles.panel} aria-label="Notifications de l'équipe">
            <header className={styles.panelHeader}>
              <div>
                <span>DIRECTION · ÉQUIPE</span>
                <h2>Notifications</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
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
                  <span aria-hidden="true">✓</span>
                  <strong>Tout est à jour</strong>
                  <p>Aucune notification d’équipe non lue.</p>
                </div>
              )}

              {notifications.map((notification) => (
                <article className={styles.item} key={notification.id}>
                  <span className={styles.itemIcon} aria-hidden="true">
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
                  <form action={openStaffNotification}>
                    <input type="hidden" name="id" value={notification.id} />
                    <button
                      className={styles.itemOpen}
                      type="submit"
                      aria-label={`Ouvrir ${notification.title}`}
                    >
                      →
                    </button>
                  </form>
                </article>
              ))}
            </div>

            <Link
              className={styles.allLink}
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
            >
              <span>Voir tout l’historique</span>
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
