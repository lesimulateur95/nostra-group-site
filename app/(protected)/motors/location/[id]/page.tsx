import Link from "next/link";
import { notFound } from "next/navigation";

import { createRentalRequestV155, joinVehicleWaitlistV155 } from "@/app/actions/v155";
import styles from "@/components/v155/v155.module.css";
import { getRentalVehiclesV155 } from "@/lib/v155/data";

const money = (value: number) =>
  value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const errorMessages: Record<string, string> = {
  dates: "Vérifie les dates de départ et de retour.",
  duration: "La durée choisie ne respecte pas les limites autorisées pour ce véhicule.",
  unavailable: "Le véhicule n'est pas disponible sur ces dates.",
  vehicle: "Ce véhicule n'est pas disponible à la location.",
  steam: "Ton compte doit être correctement associé à Steam pour effectuer le paiement.",
  "payment-funds": "Fonds insuffisants pour payer la location et la caution de 20 %.",
  "payment-bank": "Le service bancaire est temporairement indisponible. Aucun paiement n'a été débité.",
  save: "La demande n'a pas pu être enregistrée. Si un paiement avait été débité, il a été automatiquement remboursé.",
};

export default async function RentalVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const vehicleId = Number(id);
  const vehicles = await getRentalVehiclesV155(true);
  const vehicle = vehicles.find((item) => item.vehicleId === vehicleId);
  if (!vehicle) return notFound();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA MOTORS · LOCATION</span>
        <h1>{vehicle.brand} {vehicle.model}</h1>
        <p>
          Choisis tes dates. Le véhicule est retiré et restitué uniquement à la concession Nostra Motors.
        </p>
        <Link className={styles.buttonAlt} href="/motors/catalogue/location">
          ← Catalogue location
        </Link>
      </section>

      {query.error && (
        <div className={styles.card}>
          <strong className={styles.bad}>
            Location impossible : {errorMessages[query.error] ?? decodeURIComponent(query.error)}
          </strong>
        </div>
      )}

      <div className={styles.split}>
        <article className={styles.card}>
          {vehicle.imageUrl ? (
            <div className={styles.media}>
              <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} />
            </div>
          ) : null}
          <h2>{vehicle.brand} {vehicle.model}</h2>
          <div className={styles.grid2}>
            <div className={styles.kpi}>
              <span>Prix du véhicule</span>
              <strong>{money(vehicle.vehiclePrice)}</strong>
            </div>
            <div className={styles.kpi}>
              <span>Tarif / jour</span>
              <strong>{money(vehicle.dailyRate)}</strong>
            </div>
            <div className={styles.kpi}>
              <span>Caution · 20 %</span>
              <strong>{money(vehicle.depositAmount)}</strong>
            </div>
            <div className={styles.kpi}>
              <span>Kilométrage inclus</span>
              <strong>{vehicle.mileageIncludedPerDay} km/j</strong>
            </div>
            <div className={styles.kpi}>
              <span>Disponibilité stock</span>
              <strong>{vehicle.stock}</strong>
            </div>
          </div>
          <div className={styles.card} style={{ marginTop: 18 }}>
            <strong>Caution Nostra Motors</strong>
            <p className={styles.small}>
              La caution correspond automatiquement à 20 % du prix du véhicule. Elle est ajoutée au paiement de la location et encaissée avec celui-ci. Après le retour du véhicule, Nostra Motors peut la rendre directement depuis le dossier de location.
            </p>
          </div>
        </article>

        <article className={styles.card}>
          <h2>Louer ce véhicule</h2>
          <form action={createRentalRequestV155} className={styles.formGrid}>
            <input type="hidden" name="vehicle_id" value={vehicle.vehicleId} />
            <label>
              Date de départ
              <input className={styles.input} type="date" name="start_date" required />
            </label>
            <label>
              Date de retour
              <input className={styles.input} type="date" name="end_date" required />
            </label>
            <div className={styles.full}>
              <p className={styles.small}>
                Durée autorisée : {vehicle.minDays} à {vehicle.maxDays} jours · Retrait concession obligatoire.
              </p>
              <p className={styles.small}>
                La caution de <strong>{money(vehicle.depositAmount)}</strong> sera ajoutée au paiement de la location.
              </p>
            </div>
            <button className={`${styles.button} ${styles.full}`} type="submit">
              Louer · payer la location + caution
            </button>
          </form>
          {vehicle.stock <= 0 && (
            <form action={joinVehicleWaitlistV155} className={styles.actions}>
              <input type="hidden" name="vehicle_id" value={vehicle.vehicleId} />
              <input type="hidden" name="reason" value="rental" />
              <button className={styles.buttonAlt}>Me mettre sur la liste d'attente</button>
            </form>
          )}
        </article>
      </div>
    </main>
  );
}
