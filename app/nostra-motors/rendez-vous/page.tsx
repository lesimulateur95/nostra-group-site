import Link from "next/link";
import { createMotorAppointment } from "@/app/actions/nostra-motors-v41";
import {
  getPublicCatalogVehiclesV41,
  vehicleLabel,
} from "@/lib/nostra-motors/v41-data";
import styles from "@/components/motors/v41.module.css";

type PageProps = {
  searchParams?: {
    sent?: string;
    error?: string;
  };
};

export default async function MotorAppointmentPage({ searchParams }: PageProps) {
  const vehicles = await getPublicCatalogVehiclesV41();
  const sent = searchParams?.sent === "1";
  const error = searchParams?.error;
  const minimumDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());

  return (
    <main className={styles.publicPage}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA MOTORS</span>
        <h1>Prise de rendez-vous</h1>
        <p className={styles.muted}>
          Réserve une visite du showroom ou demande l’essai d’un véhicule du catalogue.
          La Direction recevra immédiatement ta demande dans son dashboard.
        </p>
      </section>

      <section className={styles.panel}>
        {sent && (
          <div className={styles.notice}>
            Ta demande a bien été envoyée. La Direction Nostra Motors va la traiter.
          </div>
        )}
        {error && (
          <div className={styles.error}>
            {error === "missing"
              ? "Certains champs obligatoires sont manquants."
              : "Le module de rendez-vous doit être activé dans Supabase avec le SQL V41."}
          </div>
        )}

        <form action={createMotorAppointment} className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="customer_name">Nom et prénom RP</label>
            <input id="customer_name" name="customer_name" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="phone">Téléphone</label>
            <input id="phone" name="phone" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" />
          </div>

          <div className={styles.field}>
            <label htmlFor="appointment_type">Type de rendez-vous</label>
            <select id="appointment_type" name="appointment_type" required>
              <option value="showroom">Visite du showroom</option>
              <option value="test_drive">Essai d’un véhicule</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="appointment_date">Date souhaitée</label>
            <input id="appointment_date" min={minimumDate} name="appointment_date" type="date" required />
          </div>

          <div className={styles.field}>
            <label htmlFor="appointment_time">Heure souhaitée</label>
            <input id="appointment_time" name="appointment_time" type="time" required />
          </div>

          <div className={styles.fieldFull}>
            <label htmlFor="vehicle_id">Véhicule concerné par l’essai</label>
            <select id="vehicle_id" name="vehicle_id">
              <option value="">Aucun véhicule précis</option>
              {vehicles.map((vehicle) => {
                const label = vehicleLabel(vehicle);
                return (
                  <option key={String(vehicle.id)} value={`${vehicle.id}|||${label}`}>
                    {label}
                  </option>
                );
              })}
            </select>
            <input
              name="vehicle_label"
              placeholder="Modèle souhaité si le véhicule n’apparaît pas dans la liste"
            />
          </div>

          <div className={styles.fieldFull}>
            <label htmlFor="message">Informations complémentaires</label>
            <textarea
              id="message"
              name="message"
              placeholder="Disponibilités, véhicule recherché, demande particulière…"
            />
          </div>

          <div className={`${styles.actions} ${styles.fieldFull}`}>
            <Link className={styles.secondaryButton} href="/nostra-motors">
              Retour à Nostra Motors
            </Link>
            <button className={styles.button} type="submit">
              Envoyer la demande
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
