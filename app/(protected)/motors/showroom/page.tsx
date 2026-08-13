/* eslint-disable @next/next/no-img-element */

import { CATALOG_LABELS, getCatalogVehiclesV51 } from "@/lib/catalogues-v51/data";
import { getShowroomConfigured, getShowroomVehicleIds } from "@/lib/nostra-motors/showroom";

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
  const [configured, showroomIds, vehicles] = await Promise.all([
    getShowroomConfigured(),
    getShowroomVehicleIds(),
    getCatalogVehiclesV51(),
  ]);

  const selected = new Set(showroomIds);
  const showroomVehicles = vehicles.filter(
    (vehicle) => vehicle.catalog_type !== "used" && selected.has(Number(vehicle.id)),
  );

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>NOSTRA MOTORS · CONCESSION</p>
        <h1>Le showroom</h1>
        <p>
          Découvre les véhicules actuellement exposés dans notre concession. Cette sélection
          correspond aux modèles physiquement présents au showroom et peut évoluer à tout moment.
        </p>
      </header>

      {!configured ? (
        <section className={styles.setup}>
          <h2>Activation du showroom nécessaire</h2>
          <p>La Direction doit exécuter le SQL V152 avant d’utiliser cette page.</p>
        </section>
      ) : (
        <>
          <section className={styles.summary}>
            <div>
              <strong>{showroomVehicles.length} véhicule{showroomVehicles.length > 1 ? "s" : ""} exposé{showroomVehicles.length > 1 ? "s" : ""}</strong>
              <br />
              <span>Sélection mise à jour directement depuis le Dashboard Nostra Motors.</span>
            </div>
          </section>

          {showroomVehicles.length === 0 ? (
            <section className={styles.empty}>
              <h2>Le showroom est en préparation</h2>
              <p>Aucun véhicule n’est actuellement indiqué comme présent dans la concession.</p>
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
                    <span className={styles.liveBadge}>PRÉSENT AU SHOWROOM</span>
                  </div>

                  <div className={styles.body}>
                    <p className={styles.catalogue}>{CATALOG_LABELS[vehicle.catalog_type]}</p>
                    <h2><span>{vehicle.brand}</span> {vehicle.model}</h2>

                    {vehicle.description && (
                      <p className={styles.description}>{vehicle.description}</p>
                    )}

                    <dl className={styles.specs}>
                      <div>
                        <dt>Puissance</dt>
                        <dd>{vehicle.power || "Non renseignée"}</dd>
                      </div>
                      <div>
                        <dt>Vitesse</dt>
                        <dd>{vehicle.top_speed || "Non renseignée"}</dd>
                      </div>
                      <div>
                        <dt>Coffre</dt>
                        <dd>{vehicle.trunk_capacity || "Non renseigné"}</dd>
                      </div>
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
