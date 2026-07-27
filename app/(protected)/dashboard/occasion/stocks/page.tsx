import { updateUsedVehicleStock } from "@/app/actions/used-vehicles";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import {
  USED_STATUS_LABELS,
  getUsedVehicleDashboardSummary,
  getUsedVehicles,
  getUsedVehiclesConfigured,
} from "@/lib/used-vehicles/data";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function UsedVehicleStocksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const configured = await getUsedVehiclesConfigured();
  const [vehicles, summary] = configured
    ? await Promise.all([getUsedVehicles(), getUsedVehicleDashboardSummary()])
    : [[], await getUsedVehicleDashboardSummary()];

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Stock — Véhicules d’occasion"
        description="Ajuste les quantités et le statut commercial de chaque véhicule racheté."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/stocks" />

      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Le stock et le statut du véhicule ont été mis à jour.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "stock"
            ? "Un véhicule disponible doit avoir au moins une unité en stock."
            : params.error === "active-order"
              ? "Une commande active bloque ce changement de statut."
              : "Impossible de modifier le stock du véhicule."}
        </div>
      )}

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Le stock occasion n’est pas encore actif</h2>
          <p>Exécute le SQL V92 puis recharge la page.</p>
        </section>
      ) : (
        <>
          <section className={styles.kpis}>
            <article className={styles.kpi}>
              <span>Disponibles</span>
              <strong>{summary.available}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Réservés</span>
              <strong>{summary.reserved}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Vendus</span>
              <strong>{summary.sold}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Valeur d’achat du stock</span>
              <strong>{money(summary.stockValue)}</strong>
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Gestion rapide du stock</h2>
                <p>
                  Le statut est normalement synchronisé automatiquement avec les commandes. Tu peux le corriger manuellement ici.
                </p>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th>Immatriculation</th>
                    <th>Prix de rachat</th>
                    <th>Prix de revente</th>
                    <th>Stock / statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.empty}>
                        Aucun véhicule d’occasion enregistré.
                      </td>
                    </tr>
                  )}
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.vehicleId}>
                      <td>
                        <strong>
                          {vehicle.brand} {vehicle.model}
                        </strong>
                        {vehicle.version && <div className={styles.muted}>{vehicle.version}</div>}
                      </td>
                      <td>{vehicle.registration || "—"}</td>
                      <td>{money(vehicle.purchasePrice)}</td>
                      <td>{money(vehicle.resalePrice)}</td>
                      <td>
                        <form action={updateUsedVehicleStock} className={styles.form}>
                          <input type="hidden" name="vehicle_id" value={vehicle.vehicleId} />
                          <label>
                            Quantité
                            <input
                              name="stock_quantity"
                              type="number"
                              min="0"
                              defaultValue={vehicle.stockQuantity}
                              required
                            />
                          </label>
                          <label>
                            Statut
                            <select name="sale_status" defaultValue={vehicle.status}>
                              {Object.entries(USED_STATUS_LABELS).map(([value, label]) => (
                                <option value={value} key={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className={styles.primary} type="submit">
                            Enregistrer
                          </button>
                        </form>
                      </td>
                      <td>
                        <span className={styles.badge}>{USED_STATUS_LABELS[vehicle.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
