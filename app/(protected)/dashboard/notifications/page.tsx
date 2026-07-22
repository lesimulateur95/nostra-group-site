import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteAllStaffNotifications,
  deleteStaffNotification,
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
  openStaffNotification,
} from "@/app/actions/staff-notifications";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getStaffNotifications,
  getStaffUnreadNotificationCount,
  hasStaffNotificationAccess,
} from "@/lib/notifications/staff-data";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const typeIcons: Record<string, string> = {
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

export default async function StaffNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    updated?: string;
    all_read?: string;
    deleted?: string;
    cleared?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!hasStaffNotificationAccess(roles)) redirect("/accueil");

  const params = await searchParams;
  const unreadOnly = params.filter === "unread";
  const [result, unreadCount] = await Promise.all([
    getStaffNotifications(data.user.id, unreadOnly),
    getStaffUnreadNotificationCount(data.user.id),
  ]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>DIRECTION · ÉQUIPE</span>
          <h1>Centre de notifications</h1>
          <p>
            Suis les commandes, rendez-vous, SAV, candidatures, licences,
            documents, plaques, enchères et livraisons depuis un seul endroit.
          </p>
        </div>
        <Link className={styles.backLink} href="/dashboard">
          ← Retour au Dashboard
        </Link>
      </section>

      {!result.configured && (
        <div className={styles.errorBanner}>
          Le centre de notifications doit être activé dans Supabase avec la
          migration V63.
        </div>
      )}

      {(params.updated || params.all_read) && (
        <div className={styles.successBanner}>
          Les notifications ont bien été mises à jour.
        </div>
      )}

      {params.deleted && (
        <div className={styles.successBanner}>
          La notification a été supprimée.
        </div>
      )}

      {params.cleared && (
        <div className={styles.successBanner}>
          L’historique des notifications d’équipe a été vidé.
        </div>
      )}

      <section className={styles.toolbar}>
        <nav className={styles.filters} aria-label="Filtres des notifications">
          <Link
            className={!unreadOnly ? styles.activeFilter : ""}
            href="/dashboard/notifications"
          >
            Toutes
          </Link>
          <Link
            className={unreadOnly ? styles.activeFilter : ""}
            href="/dashboard/notifications?filter=unread"
          >
            Non lues
          </Link>
        </nav>

        <div className={styles.toolbarRight}>
          <span className={styles.unreadCount}>
            <strong>{unreadCount}</strong> notification
            {unreadCount > 1 ? "s" : ""} non lue
            {unreadCount > 1 ? "s" : ""}
          </span>
          <form action={markAllStaffNotificationsRead}>
            <button className={styles.secondaryButton} type="submit">
              Tout marquer comme lu
            </button>
          </form>
          <form action={deleteAllStaffNotifications}>
            <button className={styles.dangerButton} type="submit">
              Vider l’historique
            </button>
          </form>
        </div>
      </section>

      <section className={styles.list}>
        {result.notifications.length === 0 && (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✓</span>
            <h2>Aucune notification</h2>
            <p>Les prochaines activités de l’équipe apparaîtront ici.</p>
          </div>
        )}

        {result.notifications.map((notification) => (
          <article
            className={`${styles.card} ${
              notification.read_at ? styles.cardRead : styles.cardUnread
            }`}
            key={notification.id}
          >
            <span className={styles.icon} aria-hidden="true">
              {typeIcons[notification.notification_type] ?? "🔔"}
            </span>

            <div className={styles.cardBody}>
              <div className={styles.cardHeading}>
                <div>
                  {!notification.read_at && (
                    <span className={styles.newBadge}>NOUVEAU</span>
                  )}
                  <h2>{notification.title}</h2>
                </div>
                <time dateTime={notification.created_at}>
                  {formatDate(notification.created_at)}
                </time>
              </div>
              <p>{notification.message}</p>
            </div>

            <div className={styles.actions}>
              {notification.target_url && (
                <form action={openStaffNotification}>
                  <input type="hidden" name="id" value={notification.id} />
                  <button className={styles.primaryButton} type="submit">
                    Ouvrir
                  </button>
                </form>
              )}

              {!notification.read_at && (
                <form action={markStaffNotificationRead}>
                  <input type="hidden" name="id" value={notification.id} />
                  <button className={styles.secondaryButton} type="submit">
                    Marquer comme lu
                  </button>
                </form>
              )}

              <form action={deleteStaffNotification}>
                <input type="hidden" name="id" value={notification.id} />
                <button className={styles.dangerButton} type="submit">
                  Supprimer
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
