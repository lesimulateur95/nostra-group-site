import { redirect } from "next/navigation";
import { updateMotorDelivery } from "@/app/actions/nostra-motors-v41";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getMotorDeliveries } from "@/lib/nostra-motors/v41-data";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/motors/v41.module.css";

function text(order: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = order[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "—";
}

export default async function DashboardDeliveriesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const allowed = roles.some((role) => ["manager", "employee", "commercial"].includes(role));
  if (!allowed) redirect("/accueil");

  const deliveries = await getMotorDeliveries();

  return (
    <DashboardShell>
      <main className={styles.dashboardPage}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>NOSTRA MOTORS</span>
          <h1>Gestion des livraisons</h1>
          <p className={styles.muted}>
            Planifie les livraisons à domicile, assigne un livreur et mets à jour leur progression.
          </p>
        </section>

        <section className={styles.list}>
          {deliveries.length === 0 && (
            <div className={styles.empty}>
              Aucune livraison à domicile trouvée. Exécute le SQL V41 pour ajouter les champs de suivi.
            </div>
          )}

          {deliveries.map((order) => (
            <article className={styles.card} key={String(order.id)}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    COMMANDE {text(order, "order_number", "reference", "id")}
                  </span>
                  <h2>{text(order, "vehicle_name", "vehicle_label", "model", "vehicle")}</h2>
                </div>
                <span className={styles.status}>
                  {text(order, "delivery_status")}
                </span>
              </div>

              <div className={styles.cardMeta}>
                <span>👤 {text(order, "customer_name", "client_name", "full_name")}</span>
                <span>📍 {text(order, "delivery_address", "address")}</span>
                <span>☎ {text(order, "customer_phone", "phone")}</span>
              </div>

              <form action={updateMotorDelivery} className={styles.formGrid}>
                <input name="id" type="hidden" value={String(order.id)} />
                <div className={styles.field}>
                  <label htmlFor={`delivery-status-${order.id}`}>Statut de livraison</label>
                  <select
                    defaultValue={String(order.delivery_status ?? "not_planned")}
                    id={`delivery-status-${order.id}`}
                    name="delivery_status"
                  >
                    <option value="not_planned">À planifier</option>
                    <option value="planned">Planifiée</option>
                    <option value="in_progress">En cours</option>
                    <option value="delivered">Livrée</option>
                    <option value="cancelled">Annulée</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor={`delivery-date-${order.id}`}>Date et heure</label>
                  <input
                    defaultValue={order.delivery_date ? String(order.delivery_date).slice(0, 16) : ""}
                    id={`delivery-date-${order.id}`}
                    name="delivery_date"
                    type="datetime-local"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor={`delivery-driver-${order.id}`}>Livreur assigné</label>
                  <input
                    defaultValue={String(order.delivery_driver ?? "")}
                    id={`delivery-driver-${order.id}`}
                    name="delivery_driver"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor={`delivery-notes-${order.id}`}>Note de livraison</label>
                  <input
                    defaultValue={String(order.delivery_notes ?? "")}
                    id={`delivery-notes-${order.id}`}
                    name="delivery_notes"
                  />
                </div>

                <div className={`${styles.actions} ${styles.fieldFull}`}>
                  <button className={styles.button} type="submit">
                    Mettre à jour la livraison
                  </button>
                </div>
              </form>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
