import { redirect } from "next/navigation";

import {
  deletePlateOrder,
  setPlateOrdersAvailability,
  updatePlateOrderStatusFromAdmin,
} from "@/app/actions/plate-orders";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeletePlateOrderButton } from "@/components/loyalty/delete-plate-order-button";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getLoyaltyAdminState } from "@/lib/loyalty/data";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusOptions = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "preparing", label: "En préparation" },
  { value: "ready", label: "Prête" },
  { value: "completed", label: "Terminée" },
  { value: "cancelled", label: "Annulée" },
];

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function dateTime(value: string): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function statusLabel(value: string): string {
  return (
    statusOptions.find((status) => status.value === value)?.label ??
    value
  );
}

export default async function PlateOrdersDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const [state, params] = await Promise.all([
    getLoyaltyAdminState(),
    searchParams,
  ]);

  const successMessage =
    params.success === "opened"
      ? "Les commandes de plaques sont maintenant ouvertes."
      : params.success === "closed"
        ? "Les commandes de plaques sont maintenant fermées."
        : params.success === "status"
          ? "Le statut de la commande a été mis à jour."
          : params.success === "deleted"
            ? "La commande de plaque a été supprimée."
            : null;

  const errorMessage =
    params.error === "delete"
      ? "La commande n’a pas pu être supprimée. Exécute le SQL V56 dans Supabase."
      : params.error === "not_found"
        ? "Cette commande n’existe plus."
        : params.error
          ? "L’action n’a pas pu être enregistrée."
          : null;

  return (
    <DashboardShell>
      <section className={`dashboard-hero ${styles.hero}`}>
        <div>
          <span className="eyebrow">DIRECTION · ADMINISTRATION</span>
          <h1 className="page-title">Commandes de plaques</h1>
          <p className="lead">
            Ouvre ou ferme le service, suis les commandes et supprime
            uniquement celles que tu souhaites retirer.
          </p>
        </div>
        <span
          className={`${styles.serviceBadge} ${
            state.plate_settings.active
              ? styles.serviceOpen
              : styles.serviceClosed
          }`}
        >
          {state.plate_settings.active
            ? "COMMANDES OUVERTES"
            : "COMMANDES FERMÉES"}
        </span>
      </section>

      {successMessage && (
        <div className={styles.successMessage}>{successMessage}</div>
      )}

      {errorMessage && (
        <div className={styles.errorMessage}>{errorMessage}</div>
      )}

      {!state.configured && (
        <div className={styles.errorMessage}>
          Le module fidélité et plaques doit être activé dans Supabase.
        </div>
      )}

      <section className={styles.servicePanel}>
        <div>
          <span className="eyebrow">SERVICE PLAQUES</span>
          <h2>Ouverture et fermeture des commandes</h2>
          <p>
            Tarif actuellement configuré :{" "}
            <strong>{money(state.plate_settings.base_price)}</strong>
          </p>
        </div>

        <div className={styles.serviceActions}>
          <form action={setPlateOrdersAvailability}>
            <input
              type="hidden"
              name="base_price"
              value={state.plate_settings.base_price}
            />
            <input type="hidden" name="active" value="true" />
            <button
              type="submit"
              className={styles.openButton}
              disabled={state.plate_settings.active}
            >
              Ouvrir les commandes
            </button>
          </form>

          <form action={setPlateOrdersAvailability}>
            <input
              type="hidden"
              name="base_price"
              value={state.plate_settings.base_price}
            />
            <input type="hidden" name="active" value="false" />
            <button
              type="submit"
              className={styles.closeButton}
              disabled={!state.plate_settings.active}
            >
              Fermer les commandes
            </button>
          </form>
        </div>
      </section>

      <section className={styles.ordersSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow">GESTION DES COMMANDES</span>
            <h2>Commandes de plaques enregistrées</h2>
          </div>
          <span className={styles.orderCount}>
            {state.plate_orders.length} commande(s)
          </span>
        </div>

        {state.plate_orders.length === 0 ? (
          <div className={styles.emptyState}>
            Aucune commande de plaque enregistrée.
          </div>
        ) : (
          <div className={styles.ordersGrid}>
            {state.plate_orders.map((order) => (
              <article className={styles.orderCard} key={order.id}>
                <div className={styles.orderHeader}>
                  <div>
                    <span className={styles.orderNumber}>
                      {order.order_number}
                    </span>
                    <h3>{order.plate_text}</h3>
                  </div>
                  <span className={styles.statusBadge}>
                    {statusLabel(order.status)}
                  </span>
                </div>

                <div className={styles.orderIdentity}>
                  <strong>{order.customer_name}</strong>
                  <span>{order.vehicle_label}</span>
                </div>

                <dl className={styles.orderDetails}>
                  <div>
                    <dt>Total</dt>
                    <dd>{money(order.total)}</dd>
                  </div>
                  <div>
                    <dt>Tarif normal</dt>
                    <dd>{money(order.base_price)}</dd>
                  </div>
                  <div>
                    <dt>Remise fidélité</dt>
                    <dd>{order.discount_percent} %</dd>
                  </div>
                  <div>
                    <dt>Créée le</dt>
                    <dd>{dateTime(order.created_at)}</dd>
                  </div>
                </dl>

                {order.notes && (
                  <p className={styles.notes}>{order.notes}</p>
                )}

                <div className={styles.orderActions}>
                  <form
                    action={updatePlateOrderStatusFromAdmin}
                    className={styles.statusForm}
                  >
                    <input
                      type="hidden"
                      name="order_id"
                      value={order.id}
                    />
                    <label htmlFor={`plate-status-${order.id}`}>
                      Statut de la commande
                    </label>
                    <div>
                      <select
                        id={`plate-status-${order.id}`}
                        name="status"
                        defaultValue={order.status}
                      >
                        {statusOptions.map((status) => (
                          <option
                            value={status.value}
                            key={status.value}
                          >
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit">Mettre à jour</button>
                    </div>
                  </form>

                  <form
                    action={deletePlateOrder}
                    className={styles.deleteForm}
                  >
                    <input
                      type="hidden"
                      name="order_id"
                      value={order.id}
                    />
                    <DeletePlateOrderButton
                      orderNumber={order.order_number}
                      className={styles.deleteButton}
                    />
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
