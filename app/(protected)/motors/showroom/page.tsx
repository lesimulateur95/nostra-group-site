/* eslint-disable @next/next/no-img-element */

import { CATALOG_LABELS, getCatalogVehiclesV51 } from "@/lib/catalogues-v51/data";
import { getShowroomConfigured } from "@/lib/nostra-motors/showroom";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPrice(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function MotorsShowroomPage() {
  const [configured, vehicles] = await Promise.all([
    getShowroomConfigured(),
    getCatalogVehiclesV51(),
  ]);

  const showroomVehicles = vehicles.filter(
    (vehicle) => vehicle.catalog_type !== "used" && vehicle.showroom_count > 0,
  );
  const showroomUnits = showroomVehicles.reduce((sum, vehicle) => sum + vehicle.showroom_count, 0);
  const demoUnits = showroomVehicles.reduce((sum, vehicle) => sum + vehicle.demo_count, 0);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>NOSTRA MOTORS · CONCESSION</p>
        <h1>Le showroom</h1>
        <p>
          Découvre les véhicules réellement présents dans notre concession. Le nombre affiché correspond
          aux exemplaires physiques actuellement affectés au showroom, indépendamment du reste du stock.
        </p>
      </header>

      {!configured ? (
        <section className={styles.setup}>
          <h2>Activation du showroom nécessaire</h2>
          <p>La Direction doit exécuter le SQL V164.3 avant d’utiliser cette page.</p>
        </section>
      ) : (
        <>
          <section className={styles.summary}>
            <div>
              <strong>
                {showroomUnits} exemplaire{showroomUnits > 1 ? "s" : ""} exposé{showroomUnits > 1 ? "s" : ""}
                {demoUnits > 0 ? ` · ${demoUnits} démonstration${demoUnits > 1 ? "s" : ""}` : ""}
              </strong>
              <br />
              <span>{showroomVehicles.length} modèle{showroomVehicles.length > 1 ? "s" : ""} actuellement représenté{showroomVehicles.length > 1 ? "s" : ""} au showroom.</span>
            </div>
          </section>

          {showroomVehicles.length === 0 ? (
            <section className={styles.empty}>
              <h2>Le showroom est en préparation</h2>
              <p>Aucun exemplaire physique n’est actuellement indiqué comme présent dans la concession.</p>
            </section>
          ) : (
            <section className={styles.grid} aria-label="Véhicules présents au showroom">
              {showroomVehicles.map((vehicle) => (
                <article className={styles.card} key={vehicle.id}>
                  <div className={styles.media}>
                    {vehicle.images[0] ? (
                      <img
                        src={vehicle.images[0].url}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.placeholder}>PHOTO À VENIR</div>
                    )}
                    <span className={styles.liveBadge}>
                      {vehicle.showroom_count} EXEMPLAIRE{vehicle.showroom_count > 1 ? "S" : ""} AU SHOWROOM
                    </span>
                  </div>

                  <div className={styles.body}>
                    <p className={styles.catalogue}>{CATALOG_LABELS[vehicle.catalog_type]}</p>
                    <h2><span>{vehicle.brand}</span> {vehicle.model}</h2>

                    {vehicle.demo_count > 0 && (
                      <p className={styles.description}>
                        <strong>
                          {vehicle.demo_count} exemplaire{vehicle.demo_count > 1 ? "s" : ""} de démonstration
                        </strong>
                        {vehicle.demo_mileage > 0 ? ` · ${vehicle.demo_mileage.toLocaleString("fr-FR")} km` : ""}
                        {vehicle.demo_note ? ` · ${vehicle.demo_note}` : ""}
                      </p>
                    )}

                    {vehicle.description && (
                      <p className={styles.description}>{vehicle.description}</p>
                    )}

                    <dl className={styles.specs}>
                      <div><dt>Puissance</dt><dd>{vehicle.power || "Non renseignée"}</dd></div>
                      <div><dt>Vitesse</dt><dd>{vehicle.top_speed || "Non renseignée"}</dd></div>
                      <div><dt>Coffre</dt><dd>{vehicle.trunk_capacity || "Non renseigné"}</dd></div>
                    </dl>

                    <div className={styles.priceRow}>
                      <span>Tarif catalogue</span>
                      <strong>{formatPrice(vehicle.price)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
