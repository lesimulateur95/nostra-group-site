import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { saveRentalInspectionV156 } from "@/app/actions/v156";
import { getRentalBookingsV155 } from "@/lib/v155/data";
import { getRentalInspectionsV156, type RentalInspectionV156 } from "@/lib/v156/data";
import styles from "@/components/v156/v156.module.css";

export default async function RentalInspectionsDashboard() {
  const [bookings, inspections] = await Promise.all([getRentalBookingsV155(), getRentalInspectionsV156()]);
  const inspectionMap = new Map<string, RentalInspectionV156>(inspections.map((row: RentalInspectionV156) => [`${row.bookingId}:${row.inspectionType}`, row]));
  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader title="États des lieux" description="Contrôle complet au départ et au retour des véhicules de location Nostra Motors." />
      <main className={styles.page} style={{ paddingTop: 10 }}>
        <div className={styles.kpiGrid}>
          <div className={styles.kpi}><span>Locations</span><strong>{bookings.length}</strong></div>
          <div className={styles.kpi}><span>Départs enregistrés</span><strong>{inspections.filter((x: RentalInspectionV156) => x.inspectionType === "departure").length}</strong></div>
          <div className={styles.kpi}><span>Retours enregistrés</span><strong>{inspections.filter((x: RentalInspectionV156) => x.inspectionType === "return").length}</strong></div>
          <div className={styles.kpi}><span>Dossiers avec dégâts</span><strong>{inspections.filter((x: RentalInspectionV156) => x.damageNotes.trim()).length}</strong></div>
        </div>
        <div className={styles.stack}>
          {bookings.map((booking: any) => (
            <article className={styles.card} key={booking.id}>
              <div className={styles.row}>
                <div><span className={styles.eyebrow}>{booking.rentalNumber}</span><h2>{booking.brand} {booking.model}</h2></div>
                <span className={styles.pill}>{String(booking.status).toUpperCase()}</span>
              </div>
              <div className={styles.grid2}>
                {(["departure", "return"] as const).map((type) => {
                  const current = inspectionMap.get(`${booking.id}:${type}`);
                  return (
                    <form action={saveRentalInspectionV156} className={styles.card} key={type}>
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <input type="hidden" name="inspection_type" value={type} />
                      <span className={styles.eyebrow}>{type === "departure" ? "DÉPART" : "RETOUR"}</span>
                      <h3>{current ? "Modifier l’état des lieux" : "Créer l’état des lieux"}</h3>
                      <div className={styles.formGrid}>
                        <label>Kilométrage<input className={styles.input} name="mileage" type="number" min="0" defaultValue={current?.mileage ?? ""} /></label>
                        <label>Carburant (%)<input className={styles.input} name="fuel_percent" type="number" min="0" max="100" defaultValue={current?.fuelPercent ?? 100} /></label>
                        <label className={styles.full}>État extérieur<textarea className={styles.textarea} name="exterior_condition" defaultValue={current?.exteriorCondition ?? ""} placeholder="Carrosserie, jantes, vitrages…" /></label>
                        <label className={styles.full}>État intérieur<textarea className={styles.textarea} name="interior_condition" defaultValue={current?.interiorCondition ?? ""} placeholder="Habitacle, sièges, tableau de bord…" /></label>
                        <label className={styles.full}>Dégâts constatés<textarea className={styles.textarea} name="damage_notes" defaultValue={current?.damageNotes ?? ""} /></label>
                        <label className={styles.full}>Commentaire client<textarea className={styles.textarea} name="customer_comment" defaultValue={current?.customerComment ?? ""} /></label>
                        <label className={styles.full}>Photos (une URL par ligne)<textarea className={styles.textarea} name="photos" defaultValue={(current?.photos ?? []).join("\n")} placeholder="https://…" /></label>
                        <button className={`${styles.button} ${styles.full}`}>{current ? "Mettre à jour" : "Enregistrer"}</button>
                      </div>
                    </form>
                  );
                })}
              </div>
            </article>
          ))}
          {!bookings.length && <div className={styles.notice}>Aucune location n’est encore enregistrée.</div>}
        </div>
      </main>
    </DashboardShell>
  );
}
