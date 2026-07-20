import {
  deleteMotorAppointment,
  updateMotorAppointment,
} from "@/app/actions/motors-appointments";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeleteAppointmentButton } from "@/components/motors/delete-appointment-button";
import { getMotorAppointments } from "@/lib/nostra-motors/v41-data";
import styles from "@/components/motors/motors-services.module.css";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  declined: "Refusé",
  completed: "Terminé",
  cancelled: "Annulé",
};

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function DashboardMotorAppointmentsPage({
  searchParams,
}: PageProps) {
  const [appointments, params] = await Promise.all([
    getMotorAppointments(),
    searchParams,
  ]);

  return (
    <DashboardShell>
      <main className={styles.dashboardPage}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            DIRECTION · NOSTRA MOTORS
          </span>
          <h1>Demandes de rendez-vous</h1>
          <p>
            Traite les visites du showroom et les demandes d’essai envoyées
            depuis la carte publique de l’accueil.
          </p>
        </section>

        {params.saved === "1" && (
          <div className={styles.success}>
            Le rendez-vous a bien été mis à jour.
          </div>
        )}

        {params.deleted === "1" && (
          <div className={styles.success}>
            La prise de rendez-vous a été supprimée définitivement.
          </div>
        )}

        {params.error && (
          <div className={styles.error}>
            {params.error === "delete"
              ? "La prise de rendez-vous n’a pas pu être supprimée."
              : "La modification n’a pas pu être enregistrée."}
          </div>
        )}

        <section className={styles.list}>
          {appointments.length === 0 && (
            <div className={styles.empty}>
              Aucune demande de rendez-vous pour le moment.
            </div>
          )}

          {appointments.map((appointment) => (
            <article className={styles.appointmentCard} key={appointment.id}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    {appointment.appointment_type === "test_drive"
                      ? "ESSAI VÉHICULE"
                      : "VISITE SHOWROOM"}
                  </span>
                  <h2>{appointment.customer_name}</h2>
                </div>

                <span className={styles.status}>
                  {statusLabels[appointment.status] ?? appointment.status}
                </span>
              </div>

              <div className={styles.meta}>
                <span>📅 {appointment.appointment_date}</span>
                <span>🕒 {appointment.appointment_time.slice(0, 5)}</span>
                <span>☎ {appointment.phone}</span>
                {appointment.email && <span>✉ {appointment.email}</span>}
              </div>

              {appointment.vehicle_label && (
                <p>
                  <strong>Véhicule :</strong> {appointment.vehicle_label}
                </p>
              )}

              {appointment.message && (
                <p>
                  <strong>Message :</strong> {appointment.message}
                </p>
              )}

              <form
                action={updateMotorAppointment}
                className={styles.formGrid}
              >
                <input name="id" type="hidden" value={appointment.id} />

                <label className={styles.field}>
                  <span>Statut</span>
                  <select name="status" defaultValue={appointment.status}>
                    <option value="pending">En attente</option>
                    <option value="confirmed">Confirmer</option>
                    <option value="declined">Refuser</option>
                    <option value="completed">Terminé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Note Direction</span>
                  <input
                    defaultValue={appointment.direction_note ?? ""}
                    name="direction_note"
                    maxLength={1000}
                    placeholder="Créneau proposé, motif du refus…"
                  />
                </label>

                <div className={styles.actions}>
                  <button className={styles.primaryButton} type="submit">
                    Enregistrer
                  </button>
                </div>
              </form>

              <form
                action={deleteMotorAppointment}
                className={styles.deleteAppointmentForm}
              >
                <input name="id" type="hidden" value={appointment.id} />
                <DeleteAppointmentButton />
              </form>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
