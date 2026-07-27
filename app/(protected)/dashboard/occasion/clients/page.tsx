import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import {
  getUsedVehicleClients,
  getUsedVehiclesConfigured,
} from "@/lib/used-vehicles/data";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function UsedVehicleClientsPage() {
  const configured = await getUsedVehiclesConfigured();
  const clients = configured ? await getUsedVehicleClients() : [];

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Clients — Véhicules d’occasion"
        description="Retrouve les citoyens ayant réservé ou acheté un véhicule d’occasion."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/clients" />

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Les clients occasion ne sont pas encore actifs</h2>
          <p>Exécute le SQL V92 puis recharge la page.</p>
        </section>
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Portefeuille clients</h2>
              <p>{clients.length} client(s) liés aux véhicules d’occasion.</p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Commandes</th>
                  <th>Ventes terminées</th>
                  <th>Montant commandé</th>
                  <th>Dernière activité</th>
                  <th>Profil</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      Aucun client pour le moment.
                    </td>
                  </tr>
                )}
                {clients.map((client) => (
                  <tr key={client.userId || client.customerName}>
                    <td><strong>{client.customerName}</strong></td>
                    <td>{client.orderCount}</td>
                    <td>{client.completedSales}</td>
                    <td>{money(client.totalOrdered)}</td>
                    <td>{new Date(client.lastOrderAt).toLocaleString("fr-FR")}</td>
                    <td>
                      {client.userId ? (
                        <Link href={`/dashboard/citoyens/${client.userId}`}>Ouvrir →</Link>
                      ) : (
                        "—"
                      )}
                    </td>
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
