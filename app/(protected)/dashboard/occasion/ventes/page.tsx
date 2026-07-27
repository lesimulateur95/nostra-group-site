import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import {
  getUsedVehicleDashboardSummary,
  getUsedVehicleSales,
  getUsedVehiclesConfigured,
} from "@/lib/used-vehicles/data";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function UsedVehicleSalesPage() {
  const configured = await getUsedVehiclesConfigured();
  const [sales, summary] = configured
    ? await Promise.all([getUsedVehicleSales(), getUsedVehicleDashboardSummary()])
    : [[], await getUsedVehicleDashboardSummary()];

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Ventes — Véhicules d’occasion"
        description="Historique des ventes réalisées, chiffre d’affaires et marge réelle calculée automatiquement."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/ventes" />

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Les ventes occasion ne sont pas encore actives</h2>
          <p>Exécute le SQL V92 puis recharge la page.</p>
        </section>
      ) : (
        <>
          <section className={styles.kpis}>
            <article className={styles.kpi}>
              <span>Ventes réalisées</span>
              <strong>{sales.length}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Chiffre d’affaires</span>
              <strong>{money(summary.turnover)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Marge réelle</span>
              <strong>{money(summary.realizedMargin)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Marge moyenne</span>
              <strong>{money(sales.length ? summary.realizedMargin / sales.length : 0)}</strong>
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Historique des ventes</h2>
                <p>Une vente apparaît ici lorsque la commande passe au statut « Livrée / vendue ».</p>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Commande</th>
                    <th>Client</th>
                    <th>Véhicule</th>
                    <th>Qté</th>
                    <th>Achat</th>
                    <th>Vente</th>
                    <th>Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={8} className={styles.empty}>
                        Aucune vente finalisée.
                      </td>
                    </tr>
                  )}
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.soldAt).toLocaleDateString("fr-FR")}</td>
                      <td>{sale.orderNumber}</td>
                      <td>{sale.customerName || "Client Nostra Motors"}</td>
                      <td>{sale.vehicleName}</td>
                      <td>{sale.quantity}</td>
                      <td>{money(sale.totalPurchasePrice)}</td>
                      <td>{money(sale.totalSalePrice)}</td>
                      <td className={sale.margin >= 0 ? styles.positive : styles.negative}>
                        <strong>{money(sale.margin)}</strong>
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
