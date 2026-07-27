import {
  deleteUsedVehicleOrder,
  updateUsedVehicleOrder,
} from "@/app/actions/used-vehicles";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import { getRequestRoleKeys } from "@/lib/auth/request-context";
import { getUsedVehicleOrders, getUsedVehiclesConfigured } from "@/lib/used-vehicles/data";

const STATUS_LABELS: Record<string, string> = {
  pending: "Envoyée",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête à être livrée",
  completed: "Livrée / vendue",
  cancelled: "Annulée",
};

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function UsedVehicleOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, roles, configured] = await Promise.all([
    searchParams,
    getRequestRoleKeys(),
    getUsedVehiclesConfigured(),
  ]);
  const orders = configured ? await getUsedVehicleOrders() : [];
  const active = orders.filter((order) => !["completed", "cancelled"].includes(order.status));
  const archived = orders.filter((order) => ["completed", "cancelled"].includes(order.status));
  const canDelete = roles.includes("manager");

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Commandes — Véhicules d’occasion"
        description="Suis uniquement les commandes contenant un véhicule d’occasion, avec les mêmes statuts que Nostra Motors."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/commandes" />

      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Le suivi de la commande a été mis à jour.
        </div>
      )}
      {params.deleted && (
        <div className="dashboard-feedback">La commande a été supprimée.</div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "unavailable"
            ? "Ce véhicule d’occasion n’est plus disponible pour réactiver la commande."
            : params.error === "stock"
              ? "Le stock est insuffisant pour réactiver cette commande."
              : "Impossible de traiter cette commande."}
        </div>
      )}

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Les commandes occasion ne sont pas encore actives</h2>
          <p>Exécute le SQL V92 puis recharge la page.</p>
        </section>
      ) : (
        <>
          <section className={styles.kpis}>
            <article className={styles.kpi}>
              <span>Commandes actives</span>
              <strong>{active.length}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Commandes terminées</span>
              <strong>{orders.filter((order) => order.status === "completed").length}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Commandes annulées</span>
              <strong>{orders.filter((order) => order.status === "cancelled").length}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Total des commandes</span>
              <strong>{orders.length}</strong>
            </article>
          </section>

          <OrderSection title="Commandes actives" orders={active} canDelete={canDelete} />
          {archived.length > 0 && (
            <OrderSection title="Historique des commandes" orders={archived} canDelete={canDelete} />
          )}
        </>
      )}
    </DashboardShell>
  );
}

function OrderSection({
  title,
  orders,
  canDelete,
}: {
  title: string;
  orders: Awaited<ReturnType<typeof getUsedVehicleOrders>>;
  canDelete: boolean;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>{title}</h2>
          <p>{orders.length} commande(s).</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className={styles.empty}>Aucune commande dans cette catégorie.</div>
      ) : (
        <div className={styles.grid}>
          {orders.map((order) => (
            <article className={styles.panel} key={order.id}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.badge}>{STATUS_LABELS[order.status] ?? order.status}</span>
                  <h3>{order.order_number}</h3>
                  <p>
                    {order.customer_name || "Client Nostra Motors"} ·{" "}
                    {new Date(order.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <strong>{money(order.total)}</strong>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th>Qté</th>
                      <th>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={`${order.id}-${index}`}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>{money(item.quantity * item.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {order.customer_note && (
                <p className={styles.muted}>Message client : {order.customer_note}</p>
              )}

              <form action={updateUsedVehicleOrder} className={styles.form}>
                <input type="hidden" name="id" value={order.id} />
                <label>
                  Statut
                  <select name="status" defaultValue={order.status}>
                    <option value="pending">Envoyée</option>
                    <option value="confirmed">Confirmée</option>
                    <option value="preparing">En préparation</option>
                    <option value="ready">Prête à être livrée</option>
                    <option value="completed">Livrée / vendue</option>
                    <option value="cancelled">Annulée</option>
                  </select>
                </label>
                <label className={styles.span3}>
                  Message visible par le client
                  <textarea
                    name="admin_note"
                    rows={3}
                    defaultValue={order.admin_note ?? ""}
                  />
                </label>
                <button className={styles.primary} type="submit">
                  Enregistrer le suivi
                </button>
              </form>

              {canDelete && (
                <form action={deleteUsedVehicleOrder} className={styles.actions}>
                  <input type="hidden" name="id" value={order.id} />
                  <button className={styles.danger} type="submit">
                    Supprimer définitivement la commande
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
