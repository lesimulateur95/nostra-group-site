
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  deleteAllNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  openNotification,
} from "@/app/actions/notifications";
import { getOwnNotifications } from "@/lib/notifications/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const typeIcons: Record<string, string> = {
  order: "🚗",
  event: "📅",
  championship: "🏁",
  homologation: "📋",
  team: "🏎️",
  reservation: "🗓️",
  invoice: "🧾",
  loyalty: "◆",
  general: "🔔",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export default async function NotificationsPage({
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

  const params = await searchParams;
  const unreadOnly = params.filter === "unread";
  const result = await getOwnNotifications(data.user.id, unreadOnly);
  const unreadCount = result.notifications.filter(
    (notification) => !notification.read_at,
  ).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ESPACE PERSONNEL</span>
          <h1>Mes notifications</h1>
          <p>
            Retrouve les mises à jour de tes commandes, les annonces
            d’événements et les informations importantes du Nostra Group.
          </p>
        </div>
        <Link className={styles.backButton} href="/profil">
          ← Retour à mon profil
        </Link>
      </header>

      {!result.configured && (
        <section className={styles.setupWarning}>
          <strong>Le centre de notifications doit être activé.</strong>
          <span>
            Exécute une seule fois le SQL V34 fourni avec le correctif.
          </span>
        </section>
      )}

      {params.all_read && (
        <p className={styles.success}>Toutes les notifications sont lues.</p>
      )}
      {params.deleted && (
        <p className={styles.success}>La notification a été supprimée.</p>
      )}
      {params.cleared && (
        <p className={styles.success}>
          Ton historique de notifications a été vidé.
        </p>
      )}

      <section className={styles.toolbar}>
        <nav className={styles.filters} aria-label="Filtrer les notifications">
          <Link
            className={!unreadOnly ? styles.activeFilter : ""}
            href="/profil/notifications"
          >
            Toutes
          </Link>
          <Link
            className={unreadOnly ? styles.activeFilter : ""}
            href="/profil/notifications?filter=unread"
          >
            Non lues
          </Link>
        </nav>

        <div className={styles.toolbarActions}>
          <span>
            {unreadCount} notification{unreadCount > 1 ? "s" : ""} non lue
            {unreadCount > 1 ? "s" : ""}
          </span>
          <form action={markAllNotificationsRead}>
            <button type="submit">Tout marquer comme lu</button>
          </form>
          <form action={deleteAllNotifications}>
            <button className={styles.dangerButton} type="submit">
              Vider l’historique
            </button>
          </form>
        </div>
      </section>

      <section className={styles.list}>
        {result.notifications.length === 0 && (
          <article className={styles.empty}>
            <span>🔔</span>
            <h2>Aucune notification</h2>
            <p>
              Les nouvelles informations apparaîtront ici automatiquement.
            </p>
          </article>
        )}

        {result.notifications.map((notification) => (
          <article
            className={`${styles.notification} ${
              notification.read_at ? styles.read : styles.unread
            }`}
            key={notification.id}
          >
            <div className={styles.notificationIcon}>
              {typeIcons[notification.notification_type] ?? "🔔"}
            </div>

            <div className={styles.notificationBody}>
              <div className={styles.notificationHeading}>
                <div>
                  {!notification.read_at && (
                    <span className={styles.unreadLabel}>NOUVEAU</span>
                  )}
                  <h2>{notification.title}</h2>
                </div>
                <time dateTime={notification.created_at}>
                  {formatDate(notification.created_at)}
                </time>
              </div>

              <p>{notification.message}</p>

              <div className={styles.notificationActions}>
                {notification.target_url && (
                  <form action={openNotification}>
                    <input
                      type="hidden"
                      name="id"
                      value={notification.id}
                    />
                    <button className={styles.openButton} type="submit">
                      Consulter l’information <span aria-hidden="true">→</span>
                    </button>
                  </form>
                )}

                {!notification.read_at && (
                  <form action={markNotificationRead}>
                    <input
                      type="hidden"
                      name="id"
                      value={notification.id}
                    />
                    <button type="submit">Marquer comme lu</button>
                  </form>
                )}

                <form action={deleteNotification}>
                  <input type="hidden" name="id" value={notification.id} />
                  <button className={styles.deleteButton} type="submit">
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
