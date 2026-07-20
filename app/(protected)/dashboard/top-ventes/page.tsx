import {
  addTopSaleVehicle,
  deleteTopSaleVehicle,
} from "@/app/actions/motors-top-sales";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getPublicCatalogVehiclesV41,
  vehicleLabel,
} from "@/lib/nostra-motors/v41-data";
import {
  getTopSaleVehicles,
  isTopSalesModuleConfigured,
} from "@/lib/nostra-motors/top-sales";
import styles from "@/components/motors/motors-services.module.css";

type PageProps = {
  searchParams: Promise<{
    added?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function DashboardTopSalesPage({
  searchParams,
}: PageProps) {
  const [catalog, topSales, configured, params] = await Promise.all([
    getPublicCatalogVehiclesV41(),
    getTopSaleVehicles(),
    isTopSalesModuleConfigured(),
    searchParams,
  ]);

  const selectedIds = new Set(
    topSales.map(({ vehicle }) => String(vehicle.id)),
  );
  const availableVehicles = catalog.filter(
    (vehicle) => !selectedIds.has(String(vehicle.id)),
  );

  return (
    <DashboardShell>
      <main className={styles.dashboardPage}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            DIRECTION · NOSTRA MOTORS
          </span>
          <h1>Véhicules en top vente</h1>
          <p>
            Choisis les véhicules visibles dans la catégorie publique. Chaque
            annonce peut être retirée indépendamment.
          </p>
        </section>

        {params.added === "1" && (
          <div className={styles.success}>
            Le véhicule a été ajouté aux top ventes.
          </div>
        )}

        {params.deleted === "1" && (
          <div className={styles.success}>
            L’annonce du véhicule a été supprimée des top ventes.
          </div>
        )}

        {params.error && (
          <div className={styles.error}>
            L’opération n’a pas pu être enregistrée.
          </div>
        )}

        {!configured ? (
          <section className={styles.error}>
            La table des top ventes n’est pas encore disponible. Exécute une
            seule fois le fichier SQL V42 fourni dans le correctif.
          </section>
        ) : (
          <>
            <section className={styles.panel}>
              <h2>Ajouter un véhicule</h2>

              <form action={addTopSaleVehicle} className={styles.inlineForm}>
                <label className={styles.growField}>
                  <span>Véhicule du catalogue</span>
                  <select name="vehicle_id" required defaultValue="">
                    <option value="" disabled>
                      Sélectionner un véhicule
                    </option>
                    {availableVehicles.map((vehicle) => (
                      <option
                        key={String(vehicle.id)}
                        value={String(vehicle.id)}
                      >
                        {vehicleLabel(vehicle)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={availableVehicles.length === 0}
                >
                  Ajouter aux top ventes
                </button>
              </form>

              {availableVehicles.length === 0 && (
                <p className={styles.helpText}>
                  Tous les véhicules disponibles sont déjà affichés.
                </p>
              )}
            </section>

            <section className={styles.list}>
              {topSales.length === 0 && (
                <div className={styles.empty}>
                  Aucun véhicule n’est actuellement en top vente.
                </div>
              )}

              {topSales.map(({ announcement, vehicle, label }) => {
                const imageUrl = vehicle.image_url ?? vehicle.photo_url;

                return (
                  <article className={styles.manageVehicle} key={announcement.id}>
                    <div className={styles.manageVehicleInfo}>
                      <div className={styles.manageThumb}>
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt={label} />
                        ) : (
                          <span>NM</span>
                        )}
                      </div>

                      <div>
                        <span className={styles.eyebrow}>ANNONCE ACTIVE</span>
                        <h2>{label}</h2>
                      </div>
                    </div>

                    <form action={deleteTopSaleVehicle}>
                      <input
                        type="hidden"
                        name="announcement_id"
                        value={announcement.id}
                      />
                      <button className={styles.deleteButton} type="submit">
                        Supprimer l’annonce
                      </button>
                    </form>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
