import { redirect } from "next/navigation";
import { updateMotorAppointment } from "@/app/actions/nostra-motors-v41";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getMotorAppointments } from "@/lib/nostra-motors/v41-data";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/motors/v41.module.css";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  declined: "Refusé",
  completed: "Terminé",
  cancelled: "Annulé",
};

export default async function DashboardMotorAppointmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const appointments = await getMotorAppointments();

  return (
    <DashboardShell>
      <main className={styles.dashboardPage}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>DIRECTION · NOSTRA MOTORS</span>
          <h1>Demandes de rendez-vous</h1>
          <p className={styles.muted}>
            Traite les visites du showroom et les demandes d’essai reçues depuis la partie publique.
          </p>
        </section>

        <section className={styles.list}>
          {appointments.length === 0 && (
            <div className={styles.empty}>
              Aucune demande de rendez-vous. Exécute le SQL V41 si le module n’est pas encore activé.
            </div>
          )}

          {appointments.map((appointment) => (
            <article className={styles.card} key={appointment.id}>
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

              <div className={styles.cardMeta}>
                <span>📅 {appointment.appointment_date}</span>
                <span>🕒 {appointment.appointment_time.slice(0, 5)}</span>
                <span>☎ {appointment.phone}</span>
                {appointment.email && <span>✉ {appointment.email}</span>}
              </div>

              {appointment.vehicle_label && (
                <p><strong>Véhicule :</strong> {appointment.vehicle_label}</p>
              )}
              {appointment.message && (
                <p><strong>Message :</strong> {appointment.message}</p>
              )}

              <form action={updateMotorAppointment} className={styles.formGrid}>
                <input name="id" type="hidden" value={appointment.id} />
                <div className={styles.field}>
                  <label htmlFor={`status-${appointment.id}`}>Statut</label>
                  <select
                    defaultValue={appointment.status}
                    id={`status-${appointment.id}`}
                    name="status"
                  >
                    <option value="pending">En attente</option>
                    <option value="confirmed">Confirmer</option>
                    <option value="declined">Refuser</option>
                    <option value="completed">Terminé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor={`note-${appointment.id}`}>Note Direction</label>
                  <input
                    defaultValue={appointment.direction_note ?? ""}
                    id={`note-${appointment.id}`}
                    name="direction_note"
                    placeholder="Créneau proposé, motif du refus…"
                  />
                </div>
                <div className={`${styles.actions} ${styles.fieldFull}`}>
                  <button className={styles.button} type="submit">
                    Enregistrer
                  </button>
                </div>
              </form>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
