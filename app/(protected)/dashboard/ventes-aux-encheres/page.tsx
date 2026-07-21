import {
  cancelVehicleAuction,
  createVehicleAuction,
  deleteVehicleAuction,
} from "@/app/actions/auctions";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getAuctionCatalogVehicles,
  getDashboardAuctions,
} from "@/lib/auctions/data";
import styles from "@/components/auctions/auctions.module.css";

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

type PageProps = {
  searchParams: Promise<{
    created?: string;
    cancelled?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function DashboardAuctionsPage({
  searchParams,
}: PageProps) {
  const [vehicles, auctions, params] = await Promise.all([
    getAuctionCatalogVehicles(),
    getDashboardAuctions(),
    searchParams,
  ]);

  return (
    <DashboardShell>
      <main className={styles.dashboardPage}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            DASHBOARD · ÉVÉNEMENTS & JEUX
          </span>
          <h1>Ventes aux enchères</h1>
          <p>
            Sélectionne un véhicule du catalogue, définis son prix de départ
            et la durée de la vente. La clôture et la notification du
            vainqueur sont automatiques.
          </p>
        </section>

        {params.created === "1" && (
          <div className={styles.success}>
            La vente aux enchères est maintenant ouverte.
          </div>
        )}

        {params.cancelled === "1" && (
          <div className={styles.success}>
            La vente a été annulée.
          </div>
        )}

        {params.deleted === "1" && (
          <div className={styles.success}>
            La vente terminée a été supprimée.
          </div>
        )}

        {params.error && (
          <div className={styles.error}>
            {params.error === "vehicle"
              ? "Le véhicule sélectionné est introuvable dans le catalogue."
              : params.error === "invalid"
                ? "Vérifie le prix de départ et la durée de la vente."
                : "L’opération n’a pas pu être enregistrée."}
          </div>
        )}

        <section className={styles.managementPanel}>
          <span className={styles.eyebrow}>NOUVELLE VENTE</span>
          <h2>Mettre un véhicule aux enchères</h2>

          <form
            action={createVehicleAuction}
            className={styles.createForm}
          >
            <label>
              <span>Véhicule du catalogue</span>
              <select name="vehicle_id" required defaultValue="">
                <option value="" disabled>
                  Sélectionner un véhicule
                </option>

                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Prix de départ</span>
              <input
                name="start_price"
                type="number"
                min={0}
                step={100}
                required
                placeholder="Exemple : 100000"
              />
            </label>

            <label>
              <span>Durée en heures</span>
              <input
                name="duration_hours"
                type="number"
                min={1}
                max={720}
                defaultValue={24}
                required
              />
              <small>
                24 = une journée, 48 = deux jours, 168 = une semaine.
              </small>
            </label>

            <label className={styles.fullField}>
              <span>Description ou conditions</span>
              <textarea
                name="description"
                rows={4}
                maxLength={2000}
                placeholder="Facultatif : état du véhicule, conditions de paiement, lieu de remise…"
              />
            </label>

            <div className={styles.formActions}>
              <button type="submit">Publier la vente</button>
            </div>
          </form>
        </section>

        <section className={styles.managementList}>
          <div className={styles.sectionTitle}>
            <div>
              <span className={styles.eyebrow}>GESTION</span>
              <h2>Ventes publiées</h2>
            </div>
            <strong>{auctions.length}</strong>
          </div>

          {auctions.length === 0 && (
            <div className={styles.empty}>
              Aucune vente aux enchères n’a encore été créée.
            </div>
          )}

          {auctions.map((auction) => (
            <article className={styles.managementCard} key={auction.id}>
              <div>
                <span className={styles.eyebrow}>
                  {auction.status === "active"
                    ? "EN COURS"
                    : auction.status === "ended"
                      ? "TERMINÉE"
                      : "ANNULÉE"}
                </span>
                <h3>{auction.vehicle_label}</h3>
                <p>
                  Départ : {money(auction.start_price)} · Actuel :{" "}
                  {money(auction.current_price)}
                </p>
                <p>
                  Fin prévue : {dateTime(auction.ends_at)} ·{" "}
                  {auction.bids.length} enchère(s)
                </p>

                {auction.winner_name && (
                  <p>
                    Meilleur enchérisseur :{" "}
                    <strong>{auction.winner_name}</strong>
                  </p>
                )}
              </div>

              <div className={styles.managementActions}>
                {auction.status === "active" ? (
                  <form action={cancelVehicleAuction}>
                    <input
                      type="hidden"
                      name="auction_id"
                      value={auction.id}
                    />
                    <button className={styles.cancelButton} type="submit">
                      Annuler la vente
                    </button>
                  </form>
                ) : (
                  <form action={deleteVehicleAuction}>
                    <input
                      type="hidden"
                      name="auction_id"
                      value={auction.id}
                    />
                    <button className={styles.deleteButton} type="submit">
                      Supprimer la vente
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
