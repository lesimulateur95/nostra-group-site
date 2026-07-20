import { redirect } from "next/navigation";
import { updateMotorDelivery } from "@/app/actions/nostra-motors-v41";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getMotorDeliveries } from "@/lib/nostra-motors/v41-data";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/motors/v41.module.css";

type DashboardDeliveriesPageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

type OrderItem = Record<string, unknown> & {
  item_type?: unknown;
  name?: unknown;
  quantity?: unknown;
};

function text(order: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = order[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }
  return "—";
}

function orderItems(order: Record<string, unknown>): OrderItem[] {
  const rawItems = order.items;

  if (Array.isArray(rawItems)) {
    return rawItems.filter(
      (item): item is OrderItem => Boolean(item) && typeof item === "object",
    );
  }

  if (typeof rawItems === "string") {
    try {
      const parsed: unknown = JSON.parse(rawItems);
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is OrderItem =>
              Boolean(item) && typeof item === "object",
          )
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function deliveryVehicleLabel(order: Record<string, unknown>): string {
  const labels = orderItems(order)
    .filter((item) => item.item_type === "delivery")
    .map((item) => {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const vehicle = name.replace(/^Livraison à domicile\s*[—-]\s*/i, "");
      const quantity = Number(item.quantity ?? 1);
      return vehicle ? `${quantity > 1 ? `${quantity} × ` : ""}${vehicle}` : "";
    })
    .filter(Boolean);

  return labels.join(" · ") || "Livraison à domicile";
}

function statusLabel(value: unknown): string {
  const labels: Record<string, string> = {
    not_planned: "À planifier",
    planned: "Planifiée",
    in_progress: "En cours",
    delivered: "Livrée",
    cancelled: "Annulée",
  };

  return labels[String(value ?? "not_planned")] ?? "À planifier";
}

function dateTimeLocalValue(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function DashboardDeliveriesPage({
  searchParams,
}: DashboardDeliveriesPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const allowed = roles.some((role) =>
    ["manager", "employee", "commercial"].includes(role),
  );
  if (!allowed) redirect("/accueil");

  const params = await searchParams;
  const deliveries = await getMotorDeliveries();

  const errorMessage =
    params.error === "date"
      ? "La date de livraison saisie n’est pas valide."
      : params.error === "invalid"
        ? "Les informations de livraison sont invalides."
        : params.error
          ? "La livraison n’a pas pu être enregistrée."
          : null;

  return (
    <DashboardShell>
      <main className={styles.dashboardPage}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>NOSTRA MOTORS</span>
          <h1>Gestion des livraisons</h1>
          <p className={styles.muted}>
            Planifie les livraisons à domicile, assigne un livreur et mets à
            jour leur progression.
          </p>
        </section>

        {params.saved && (
          <div className="dashboard-feedback dashboard-feedback-success">
            La livraison a bien été mise à jour.
          </div>
        )}
        {errorMessage && (
          <div className="dashboard-feedback dashboard-feedback-error">
            {errorMessage}
          </div>
        )}

        <section className={styles.list}>
          {deliveries.length === 0 && (
            <div className={styles.empty}>
              Aucune commande avec livraison à domicile n’est actuellement à
              traiter.
            </div>
          )}

          {deliveries.map((order) => {
            const address = text(order, "delivery_address", "address");
            const phone = text(order, "customer_phone", "phone");
            const customerNote = text(order, "customer_note");

            return (
              <article className={styles.card} key={String(order.id)}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.eyebrow}>
                      COMMANDE {text(order, "order_number", "reference", "id")}
                    </span>
                    <h2>{deliveryVehicleLabel(order)}</h2>
                  </div>
                  <span className={styles.status}>
                    {statusLabel(order.delivery_status)}
                  </span>
                </div>

                <div className={styles.cardMeta}>
                  <span>
                    👤 {text(order, "customer_name", "client_name", "full_name")}
                  </span>
                  <span>
                    📍 {address === "—" ? "Adresse non renseignée" : address}
                  </span>
                  <span>☎ {phone === "—" ? "Téléphone non renseigné" : phone}</span>
                  {customerNote !== "—" && <span>📝 {customerNote}</span>}
                </div>

                <form action={updateMotorDelivery} className={styles.formGrid}>
                  <input name="id" type="hidden" value={String(order.id)} />

                  <div className={styles.field}>
                    <label htmlFor={`delivery-status-${order.id}`}>
                      Statut de livraison
                    </label>
                    <select
                      defaultValue={String(
                        order.delivery_status ?? "not_planned",
                      )}
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
                    <label htmlFor={`delivery-date-${order.id}`}>
                      Date et heure
                    </label>
                    <input
                      defaultValue={dateTimeLocalValue(order.delivery_date)}
                      id={`delivery-date-${order.id}`}
                      name="delivery_date"
                      type="datetime-local"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`delivery-driver-${order.id}`}>
                      Livreur assigné
                    </label>
                    <input
                      defaultValue={String(order.delivery_driver ?? "")}
                      id={`delivery-driver-${order.id}`}
                      name="delivery_driver"
                      placeholder="Nom du livreur"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`delivery-notes-${order.id}`}>
                      Note de livraison
                    </label>
                    <input
                      defaultValue={String(order.delivery_notes ?? "")}
                      id={`delivery-notes-${order.id}`}
                      name="delivery_notes"
                      placeholder="Consignes ou informations internes"
                    />
                  </div>

                  <div className={`${styles.actions} ${styles.fieldFull}`}>
                    <button className={styles.button} type="submit">
                      Mettre à jour la livraison
                    </button>
                  </div>
                </form>
              </article>
            );
          })}
        </section>
      </main>
    </DashboardShell>
  );
}
