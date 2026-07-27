/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import { toggleUsedVehiclePublication } from "@/app/actions/used-vehicles";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import {
  USED_CONDITION_LABELS,
  USED_STATUS_LABELS,
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

export default async function UsedVehicleCatalogueDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const configured = await getUsedVehiclesConfigured();
  const vehicles = configured ? await getUsedVehicles() : [];

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Catalogue — Véhicules d’occasion"
        description="Contrôle exactement ce qui est visible par les clients, sans afficher le prix de rachat ni les notes internes."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/catalogue" />

      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La visibilité publique du véhicule a été mise à jour.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Impossible de modifier ce véhicule.
        </div>
      )}

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Le catalogue occasion n’est pas encore actif</h2>
          <p>Exécute le SQL V92 puis recharge la page.</p>
        </section>
      ) : (
        <>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Aperçu du catalogue public</h2>
                <p>
                  Le public voit uniquement les photos, la description, l’état, le prix de vente et le statut.
                </p>
              </div>
              <Link className={styles.secondary} href="/motors/catalogue/vehicules-occasion">
                Ouvrir le catalogue public
              </Link>
            </div>
          </section>

          <section className={styles.grid + " " + styles.section}>
            {vehicles.length === 0 && (
              <div className={styles.panel + " " + styles.empty}>
                Aucun véhicule d’occasion enregistré.
              </div>
            )}

            {vehicles.map((vehicle) => (
              <article className={styles.vehicleCard} key={vehicle.vehicleId}>
                <div className={styles.vehicleTop}>
                  {vehicle.images[0] ? (
                    <img
                      className={styles.vehicleImage}
                      src={vehicle.images[0].url}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                    />
                  ) : (
                    <div className={styles.placeholder}>PHOTO À VENIR</div>
                  )}

                  <div className={styles.vehicleCopy}>
                    <p>{vehicle.brand}</p>
                    <h2>
                      {vehicle.model}
                      {vehicle.version ? ` ${vehicle.version}` : ""}
                    </h2>
                    <div className={styles.badges}>
                      <span className={styles.badge}>
                        {USED_CONDITION_LABELS[vehicle.condition]}
                      </span>
                      <span className={styles.badge}>
                        {USED_STATUS_LABELS[vehicle.status]}
                      </span>
                      <span className={styles.badge}>Stock : {vehicle.stockQuantity}</span>
                    </div>
                    <div className={styles.moneyGrid}>
                      <div>
                        <span>Prix public</span>
                        <strong>{money(vehicle.resalePrice)}</strong>
                      </div>
                      <div>
                        <span>Visibilité</span>
                        <strong>{vehicle.published ? "Publié" : "Masqué"}</strong>
                      </div>
                      <div>
                        <span>Photos</span>
                        <strong>{vehicle.images.length}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.panel} style={{ border: 0, borderRadius: 0 }}>
                  <p className={styles.muted}>
                    {vehicle.description || "Aucune description publique renseignée."}
                  </p>
                  <form action={toggleUsedVehiclePublication} className={styles.actions}>
                    <input type="hidden" name="vehicle_id" value={vehicle.vehicleId} />
                    <input type="hidden" name="published" value={vehicle.published ? "0" : "1"} />
                    <button className={vehicle.published ? styles.danger : styles.primary} type="submit">
                      {vehicle.published ? "Masquer du catalogue" : "Publier dans le catalogue"}
                    </button>
                    <Link className={styles.secondary} href="/dashboard/occasion/rachats">
                      Modifier la fiche complète
                    </Link>
                  </form>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
