import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import {
  getUsedVehicleDocuments,
  getUsedVehiclesConfigured,
} from "@/lib/used-vehicles/data";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function UsedVehicleDocumentsPage() {
  const configured = await getUsedVehiclesConfigured();
  const documents = configured ? await getUsedVehicleDocuments() : [];

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Documents — Véhicules d’occasion"
        description="Documents générés pour les commandes et ventes de la concession d’occasion."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/documents" />

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Les documents occasion ne sont pas encore actifs</h2>
          <p>Exécute le SQL V92 puis recharge la page.</p>
        </section>
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Documents de vente</h2>
              <p>Les documents sont également visibles dans l’espace personnel du client.</p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Commande</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      Aucun document généré.
                    </td>
                  </tr>
                )}
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td><strong>{document.invoiceNumber}</strong></td>
                    <td>{document.documentTitle || document.documentType}</td>
                    <td>{document.orderId ?? "—"}</td>
                    <td>{new Date(document.issuedAt).toLocaleString("fr-FR")}</td>
                    <td>{document.status}</td>
                    <td>{money(document.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
