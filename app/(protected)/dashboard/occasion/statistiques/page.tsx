import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import {
  getUsedVehicleDashboardSummary,
  getUsedVehicleSales,
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

export default async function UsedVehicleStatisticsPage() {
  const configured = await getUsedVehiclesConfigured();
  const [summary, vehicles, sales] = configured
    ? await Promise.all([
        getUsedVehicleDashboardSummary(),
        getUsedVehicles(),
        getUsedVehicleSales(),
      ])
    : [await getUsedVehicleDashboardSummary(), [], []];

  const topMargins = [...sales].sort((a, b) => b.margin - a.margin).slice(0, 10);
  const averagePurchase = vehicles.length
    ? vehicles.reduce((total, vehicle) => total + vehicle.purchasePrice, 0) / vehicles.length
    : 0;
  const averageResale = vehicles.length
    ? vehicles.reduce((total, vehicle) => total + vehicle.resalePrice, 0) / vehicles.length
    : 0;

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Statistiques — Véhicules d’occasion"
        description="Analyse du stock, des marges prévues et des ventes réellement finalisées."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/statistiques" />

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Les statistiques occasion ne sont pas encore actives</h2>
          <p>Exécute le SQL V92 puis recharge la page.</p>
        </section>
      ) : (
        <>
          <section className={styles.kpis}>
            <article className={styles.kpi}>
              <span>Valeur d’achat du stock</span>
              <strong>{money(summary.stockValue)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Marge prévue du stock</span>
              <strong>{money(summary.expectedMargin)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Chiffre d’affaires réalisé</span>
              <strong>{money(summary.turnover)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Marge réelle réalisée</span>
              <strong>{money(summary.realizedMargin)}</strong>
            </article>
          </section>

          <section className={styles.grid}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Indicateurs moyens</h2>
                  <p>Valeurs unitaires sur les véhicules enregistrés.</p>
                </div>
              </div>
              <div className={styles.moneyGrid}>
                <div>
                  <span>Rachat moyen</span>
                  <strong>{money(averagePurchase)}</strong>
                </div>
                <div>
                  <span>Revente moyenne</span>
                  <strong>{money(averageResale)}</strong>
                </div>
                <div>
                  <span>Marge moyenne réalisée</span>
                  <strong>{money(sales.length ? summary.realizedMargin / sales.length : 0)}</strong>
                </div>
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Répartition du parc</h2>
                  <p>État commercial actuel.</p>
                </div>
              </div>
              <div className={styles.moneyGrid}>
                <div><span>Disponibles</span><strong>{summary.available}</strong></div>
                <div><span>Réservés</span><strong>{summary.reserved}</strong></div>
                <div><span>Vendus</span><strong>{summary.sold}</strong></div>
              </div>
            </article>
          </section>

          <section className={styles.panel + " " + styles.section}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Meilleures marges réalisées</h2>
                <p>Classement des ventes les plus rentables.</p>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th>Client</th>
                    <th>Rachat</th>
                    <th>Vente</th>
                    <th>Marge</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {topMargins.length === 0 && (
                    <tr><td colSpan={6} className={styles.empty}>Aucune vente finalisée.</td></tr>
                  )}
                  {topMargins.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.vehicleName}</td>
                      <td>{sale.customerName}</td>
                      <td>{money(sale.totalPurchasePrice)}</td>
                      <td>{money(sale.totalSalePrice)}</td>
                      <td className={sale.margin >= 0 ? styles.positive : styles.negative}>
                        <strong>{money(sale.margin)}</strong>
                      </td>
                      <td>{new Date(sale.soldAt).toLocaleDateString("fr-FR")}</td>
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
