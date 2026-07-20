import { deleteOrder, updateOrder } from "@/app/actions/orders";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOrderModuleConfigured, getOrders } from "@/lib/backoffice/data";
import { ORDERS_SETUP_SQL } from "@/lib/backoffice/orders-setup-sql";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  pending: "Envoyée",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête à être livrée",
  completed: "Livrée",
  cancelled: "Annulée",
};

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default async function OrdersDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const roles = await getUserRoleKeys(authData.user);
  const canDeleteOrders = roles.includes("manager");
  const configured = await getOrderModuleConfigured();
  const orders = configured ? await getOrders() : [];
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.status));
  const archivedOrders = orders.filter((order) => ["completed", "cancelled"].includes(order.status));

  return (
    <DashboardShell>
      <DashboardHeader title="Commandes Nostra Motors" description="Toutes les commandes passées depuis le panier des citoyens arrivent ici automatiquement." />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les commandes du catalogue</h2>
          <p>Ajoute les informations détaillées des commandes et autorise les citoyens à valider leur panier.</p>
          <details open><summary>Afficher le code SQL à copier dans Supabase</summary><pre>{ORDERS_SETUP_SQL}</pre></details>
          <ol>
            <li>Copie tout le code ci-dessus.</li>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle le code, clique sur <strong>Run query</strong>, puis reviens ici et fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      )}

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le statut de la commande a été mis à jour.</div>}
      {params.deleted && <div className="dashboard-feedback">La commande a été supprimée définitivement.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de traiter cette commande.</div>}

      {configured && (
        <>
          <section className="reservation-admin-summary">
            <article><span>Commandes actives</span><strong>{activeOrders.length}</strong></article>
            <article><span>Total reçu</span><strong>{orders.length}</strong></article>
          </section>

          <section className="orders-admin-list">
            {activeOrders.length === 0 && <div className="backoffice-panel empty-state">Aucune commande active.</div>}
            {activeOrders.map((order) => <OrderCard key={order.id} order={order} canDelete={canDeleteOrders} />)}
          </section>

          {archivedOrders.length > 0 && (
            <section className="processed-reservations">
              <div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">HISTORIQUE</p><h2>Commandes terminées ou annulées</h2></div>
              <div className="orders-admin-list">{archivedOrders.map((order) => <OrderCard key={order.id} order={order} canDelete={canDeleteOrders} />)}</div>
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}

function OrderCard({
  order,
  canDelete,
}: {
  order: Awaited<ReturnType<typeof getOrders>>[number];
  canDelete: boolean;
}) {
  return (
    <article className="backoffice-panel order-admin-card">
      <div className="order-admin-head">
        <div>
          <span className={`request-status order-status-${order.status}`}>{statusLabels[order.status] ?? order.status}</span>
          <h2>{order.order_number}</h2>
          <p><strong>{order.customer_name || "Client Nostra Motors"}</strong> · {new Date(order.created_at).toLocaleString("fr-FR")}</p>
        </div>
        <strong className="order-admin-total">{money(order.total)}</strong>
      </div>

      <div className="order-items-list">
        {order.items.map((item, index) => (
          <div key={`${order.id}-${index}`}>
            <span>
              {item.quantity} × {item.name}
              {item.delivery_address && (
                <small className="order-delivery-address">
                  Adresse : {item.delivery_address}
                </small>
              )}
            </span>
            <strong>{money(item.quantity * item.unit_price)}</strong>
          </div>
        ))}
      </div>

      {order.customer_note && <div className="reservation-reason"><span>Message du client</span><p>{order.customer_note}</p></div>}

      <form action={updateOrder} className="backoffice-form homologation-review-form">
        <input type="hidden" name="id" value={order.id} />
        <label>Statut<select name="status" defaultValue={order.status}>
          <option value="pending">Envoyée</option>
          <option value="confirmed">Confirmée</option>
          <option value="preparing">En préparation</option>
          <option value="ready">Prête à être livrée</option>
          <option value="completed">Livrée</option>
          <option value="cancelled">Annulée</option>
        </select></label>
        <label className="form-span-2">Message visible par le client<textarea name="admin_note" rows={3} defaultValue={order.admin_note ?? ""} placeholder="Exemple : Votre véhicule est en cours de préparation." /></label>
        <button className="btn" type="submit">Enregistrer le suivi</button>
      </form>

      {canDelete && (
        <form action={deleteOrder} className="danger-form">
          <input type="hidden" name="id" value={order.id} />
          <button type="submit">
            Supprimer définitivement la commande
          </button>
        </form>
      )}
    </article>
  );
}
