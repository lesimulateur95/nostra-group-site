import Link from "next/link";

import { createMotorAppointment } from "@/app/actions/motors-appointments";
import {
  getPublicCatalogVehiclesV41,
  vehicleLabel,
} from "@/lib/nostra-motors/v41-data";
import styles from "@/components/motors/motors-services.module.css";

type PageProps = {
  searchParams: Promise<{
    sent?: string;
    error?: string;
  }>;
};

export default async function MotorAppointmentPage({
  searchParams,
}: PageProps) {
  const [vehicles, params] = await Promise.all([
    getPublicCatalogVehiclesV41(),
    searchParams,
  ]);

  const minimumDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>SERVICE CLIENT · NOSTRA MOTORS</span>
        <h1>Prise de rendez-vous</h1>
        <p>
          Indique librement le motif de ta demande. Elle arrivera directement
          dans la section Nostra Motors du Dashboard.
        </p>
      </section>

      <section className={styles.panel}>
        {params.sent === "1" && (
          <div className={styles.success}>
            Ta demande a bien été envoyée à Nostra Motors.
          </div>
        )}

        {params.error && (
          <div className={styles.error}>
            {params.error === "missing"
              ? "Vérifie les champs obligatoires ainsi que la date choisie."
              : "La demande n’a pas pu être enregistrée. Réessaie dans un instant."}
          </div>
        )}

        <form action={createMotorAppointment} className={styles.formGrid}>
          <label className={styles.field}>
            <span>Nom et prénom RP</span>
            <input name="customer_name" required minLength={2} maxLength={80} />
          </label>

          <label className={styles.field}>
            <span>Téléphone</span>
            <input name="phone" required maxLength={40} />
          </label>

          <label className={styles.field}>
            <span>E-mail</span>
            <input name="email" type="email" maxLength={150} />
          </label>

          <label className={styles.field}>
            <span>Date souhaitée</span>
            <input
              min={minimumDate}
              name="appointment_date"
              type="date"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Heure souhaitée</span>
            <input name="appointment_time" type="time" required />
          </label>

          <label className={styles.field}>
            <span>Véhicule concerné</span>
            <select name="vehicle_id" defaultValue="">
              <option value="">Aucun véhicule précis</option>
              {vehicles.map((vehicle) => {
                const label = vehicleLabel(vehicle);

                return (
                  <option
                    key={String(vehicle.id)}
                    value={`${vehicle.id}|||${label}`}
                  >
                    {label}
                  </option>
                );
              })}
            </select>
          </label>

          <label className={styles.fieldFull}>
            <span>Autre véhicule</span>
            <input
              name="vehicle_label"
              maxLength={150}
              placeholder="À remplir uniquement si le véhicule n’est pas dans la liste"
            />
          </label>

          <label className={styles.fieldFull}>
            <span>Motif du rendez-vous</span>
            <textarea
              name="message"
              rows={5}
              minLength={3}
              maxLength={1500}
              required
              placeholder="Écris librement le motif de ta demande…"
            />
          </label>

          <div className={styles.actions}>
            <Link className={styles.secondaryButton} href="/accueil">
              Retour à l’accueil
            </Link>
            <button className={styles.primaryButton} type="submit">
              Envoyer la demande
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
