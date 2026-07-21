import { redirect } from "next/navigation";

import {
  assignLoyaltyTier,
  removeLoyaltyTier,
  updatePlateOrderStatus,
  updatePlateSettings,
} from "@/app/actions/loyalty";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getLoyaltyAdminState } from "@/lib/loyalty/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  }).format(new Date(value));
}

export default async function LoyaltyDashboardPage({
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

  const success =
    params.success === "assigned"
      ? "Le grade de fidélité a été attribué."
      : params.success === "removed"
        ? "Le grade de fidélité a été retiré."
        : params.success === "settings"
          ? "Le tarif des plaques a été enregistré."
          : params.success === "order"
            ? "Le statut de la commande de plaque a été mis à jour."
            : null;

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <span>DIRECTION · NOSTRA MOTORS</span>
          <h1>Programme de fidélité</h1>
          <p>
            Attribue les grades aux citoyens, retire-les lorsque
            nécessaire et gère les nouvelles commandes de plaques.
          </p>
        </section>

        {success && (
          <div className={styles.success}>{success}</div>
        )}

        {params.error && (
          <div className={styles.error}>
            L’action n’a pas pu être enregistrée.
          </div>
        )}

        {!state.configured && (
          <div className={styles.error}>
            Exécute le SQL V48 avant d’utiliser cette page.
          </div>
        )}

        <section className={styles.settings}>
          <div>
            <span>SERVICE PLAQUES</span>
            <h2>Tarif et disponibilité</h2>
          </div>

          <form action={updatePlateSettings}>
            <label>
              Tarif normal
              <input
                name="base_price"
                type="number"
                min={0}
                step={1000}
                defaultValue={state.plate_settings.base_price}
                required
              />
            </label>

            <label>
              État du service
              <select
                name="active"
                defaultValue={
                  state.plate_settings.active
                    ? "true"
                    : "false"
                }
              >
                <option value="true">
                  Commandes ouvertes
                </option>
                <option value="false">
                  Commandes fermées
                </option>
              </select>
            </label>

            <button type="submit">Enregistrer</button>
          </form>
        </section>

        <section className={styles.section}>
          <header>
            <span>CITOYENS</span>
            <h2>Ajouter ou retirer un grade fidélité</h2>
            <p>
              Seuls les profils reconnus comme Citoyen ou Membre
              apparaissent ici.
            </p>
          </header>

          <div className={styles.citizenList}>
            {state.citizens.length === 0 && (
              <div className={styles.empty}>
                Aucun citoyen trouvé.
              </div>
            )}

            {state.citizens.map((citizen) => (
              <article
                className={styles.citizen}
                key={citizen.user_id}
              >
                <div>
                  <strong>{citizen.name}</strong>
                  <span>
                    {citizen.email ?? "Adresse non renseignée"}
                  </span>
                  <b>
                    {citizen.tier_label ??
                      "Aucun grade fidélité"}
                  </b>
                </div>

                <form action={assignLoyaltyTier}>
                  <input
                    type="hidden"
                    name="user_id"
                    value={citizen.user_id}
                  />

                  <select
                    name="tier_code"
                    defaultValue={
                      citizen.tier_code ??
                      state.tiers[0]?.code ??
                      ""
                    }
                    required
                  >
                    {state.tiers.map((tier) => (
                      <option
                        key={tier.code}
                        value={tier.code}
                      >
                        {tier.label} ·{" "}
                        {tier.catalog_discount_percent} %
                        catalogue
                      </option>
                    ))}
                  </select>

                  <button type="submit">
                    Attribuer le grade
                  </button>
                </form>

                {citizen.tier_code && (
                  <form action={removeLoyaltyTier}>
                    <input
                      type="hidden"
                      name="user_id"
                      value={citizen.user_id}
                    />
                    <button
                      className={styles.danger}
                      type="submit"
                    >
                      Retirer le grade
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <header>
            <span>COMMANDES DE PLAQUES</span>
            <h2>Suivi des nouvelles plaques</h2>
          </header>

          <div className={styles.orderList}>
            {state.plate_orders.length === 0 && (
              <div className={styles.empty}>
                Aucune commande de plaque.
              </div>
            )}

            {state.plate_orders.map((order) => (
              <article
                className={styles.order}
                key={order.id}
              >
                <div className={styles.orderHeading}>
                  <div>
                    <span>{order.order_number}</span>
                    <h3>{order.plate_text}</h3>
                    <p>
                      {order.customer_name} ·{" "}
                      {order.vehicle_label}
                    </p>
                  </div>

                  <strong>{money(order.total)}</strong>
                </div>

                <dl>
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
                  <div>
                    <dt>Statut</dt>
                    <dd>{order.status}</dd>
                  </div>
                </dl>

                {order.notes && <p>{order.notes}</p>}

                <form action={updatePlateOrderStatus}>
                  <input
                    type="hidden"
                    name="order_id"
                    value={order.id}
                  />

                  <select
                    name="status"
                    defaultValue={order.status}
                  >
                    <option value="pending">
                      En attente
                    </option>
                    <option value="confirmed">
                      Confirmée
                    </option>
                    <option value="preparing">
                      En préparation
                    </option>
                    <option value="ready">Prête</option>
                    <option value="completed">
                      Terminée
                    </option>
                    <option value="cancelled">
                      Annulée
                    </option>
                  </select>

                  <button type="submit">
                    Mettre à jour
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
