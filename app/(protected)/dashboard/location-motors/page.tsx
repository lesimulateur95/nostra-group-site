import { returnRentalDepositV157, saveRentalSettingV155, updateRentalBookingV155 } from "@/app/actions/v155";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import styles from "@/components/v155/v155.module.css";
import { getRentalBookingsV155, getRentalVehiclesV155 } from "@/lib/v155/data";

const money = (value: number) =>
  value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

function depositStatusLabel(value: string) {
  const labels: Record<string, string> = {
    not_held: "Non encaissée",
    not_paid: "Non encaissée",
    held: "Ancienne caution bloquée",
    paid: "Encaissée",
    refund_processing: "Restitution en cours",
    refunded: "Restituée",
    partially_refunded: "Partiellement restituée",
    retained: "Retenue",
  };
  return labels[value] ?? value;
}

const errorMessages: Record<string, string> = {
  steam: "Impossible de restituer la caution : aucun Steam ID n'est associé au citoyen.",
  "deposit-refund": "La restitution de la caution a échoué. Aucune modification n’a été appliquée au dossier.",
  "payment-refund": "Le remboursement du paiement de la location a échoué.",
  "deposit-state": "La caution est déjà en cours de traitement ou a déjà été rendue.",
  "deposit-return-status": "Le véhicule doit d’abord être marqué comme rendu avant de pouvoir rendre la caution.",
  booking: "Impossible de mettre à jour ce dossier de location.",
};

export default async function RentalDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; booking_saved?: string; deposit_refunded?: string }>;
}) {
  const [vehicles, bookings, query] = await Promise.all([
    getRentalVehiclesV155(true),
    getRentalBookingsV155(),
    searchParams,
  ]);

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Location Nostra Motors"
        description="Tarifs, caution encaissée à 20 %, disponibilités, départs, retours et restitution de caution depuis le dossier de location."
      />
      <main className={styles.page} style={{ paddingTop: 10 }}>
        {query.error && (
          <div className={styles.card}>
            <strong className={styles.bad}>
              {errorMessages[query.error] ?? "Une erreur est survenue."}
            </strong>
          </div>
        )}
        {(query.saved || query.booking_saved || query.deposit_refunded) && (
          <div className={styles.card}>
            <strong>{query.deposit_refunded ? "Caution rendue au citoyen avec succès." : "Modification enregistrée."}</strong>
          </div>
        )}

        <section className={styles.sectionTitle}>
          <span className={styles.eyebrow}>FLOTTE DE LOCATION</span>
          <h2>Paramètres véhicules</h2>
          <p>
            La caution correspond toujours à <strong>20 % du prix catalogue</strong>. Elle est ajoutée au paiement de la location puis reste enregistrée dans le dossier jusqu’à sa restitution.
          </p>
        </section>
        <div className={styles.grid}>
          {vehicles.map((vehicle) => (
            <form className={styles.card} action={saveRentalSettingV155} key={vehicle.vehicleId}>
              <input type="hidden" name="vehicle_id" value={vehicle.vehicleId} />
              <h3>{vehicle.brand} {vehicle.model}</h3>
              <div className={styles.grid2} style={{ marginBottom: 18 }}>
                <div className={styles.kpi}>
                  <span>Prix véhicule</span>
                  <strong>{money(vehicle.vehiclePrice)}</strong>
                </div>
                <div className={styles.kpi}>
                  <span>Caution encaissée · 20 %</span>
                  <strong>{money(vehicle.depositAmount)}</strong>
                </div>
              </div>
              <div className={styles.formGrid}>
                <label>
                  Tarif / jour
                  <input className={styles.input} name="daily_rate" type="number" defaultValue={vehicle.dailyRate} />
                </label>
                <label>
                  Durée min
                  <input className={styles.input} name="min_days" type="number" defaultValue={vehicle.minDays} />
                </label>
                <label>
                  Durée max
                  <input className={styles.input} name="max_days" type="number" defaultValue={vehicle.maxDays} />
                </label>
                <label>
                  Km/jour inclus
                  <input className={styles.input} name="mileage_included_per_day" type="number" defaultValue={vehicle.mileageIncludedPerDay} />
                </label>
                <label>
                  Prix km supplémentaire
                  <input className={styles.input} name="extra_km_price" type="number" step="0.01" defaultValue={vehicle.extraKmPrice} />
                </label>
                <label className={styles.full}>
                  <input type="checkbox" name="active" defaultChecked={vehicle.active} /> Location active
                </label>
                <button className={`${styles.button} ${styles.full}`}>Enregistrer</button>
              </div>
            </form>
          ))}
        </div>

        <section className={styles.sectionTitle}>
          <span className={styles.eyebrow}>DOSSIERS</span>
          <h2>Locations en cours</h2>
          <p>
            Quand le véhicule revient, marque le dossier <strong>returned</strong>. Le bouton <strong>Rendre la caution</strong> apparaîtra ensuite directement sur cette fiche.
          </p>
        </section>
        <div className={styles.stack}>
          {bookings.map((booking: any) => (
            <form className={styles.card} action={updateRentalBookingV155} key={booking.id}>
              <input type="hidden" name="id" value={booking.id} />
              <div className={styles.row}>
                <div>
                  <strong>{booking.rentalNumber} · {booking.brand} {booking.model}</strong>
                  <p>{booking.startDate} → {booking.endDate}</p>
                </div>
                <span className={styles.pill}>{booking.status}</span>
              </div>
              <div className={styles.grid2} style={{ marginBottom: 18 }}>
                <div className={styles.kpi}>
                  <span>Locataire</span>
                  <strong>{`${booking.renterFirstName ?? ""} ${booking.renterLastName ?? ""}`.trim() || "Citoyen"}</strong>
                </div>
                <div className={styles.kpi}>
                  <span>Téléphone</span>
                  <strong>{booking.renterPhone || "—"}</strong>
                </div>
                <div className={styles.kpi}>
                  <span>Caution</span>
                  <strong>{money(Number(booking.depositAmount ?? 0))}</strong>
                </div>
                <div className={styles.kpi}>
                  <span>État caution</span>
                  <strong>{depositStatusLabel(String(booking.depositStatus ?? "not_held"))}</strong>
                </div>
              </div>
              <div className={styles.formGrid}>
                <label>
                  Statut
                  <select className={styles.select} name="status" defaultValue={booking.status}>
                    {["pending", "confirmed", "ready", "active", "returned", "cancelled", "rejected"].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Kilométrage départ
                  <input className={styles.input} type="number" name="mileage_out" defaultValue={booking.mileageOut ?? ""} />
                </label>
                <label>
                  Kilométrage retour
                  <input className={styles.input} type="number" name="mileage_in" defaultValue={booking.mileageIn ?? ""} />
                </label>
                <label className={styles.full}>
                  État départ
                  <textarea className={styles.textarea} name="condition_out" defaultValue={booking.conditionOut ?? ""} />
                </label>
                <label className={styles.full}>
                  État retour
                  <textarea className={styles.textarea} name="condition_in" defaultValue={booking.conditionIn ?? ""} />
                </label>
                <label className={styles.full}>
                  Dégâts
                  <textarea className={styles.textarea} name="damage_notes" defaultValue={booking.damageNotes ?? ""} />
                </label>
                <label className={styles.full}>
                  Notes staff
                  <textarea className={styles.textarea} name="staff_notes" defaultValue={booking.staffNotes ?? ""} />
                </label>
                <button className={`${styles.button} ${styles.full}`}>Mettre à jour le dossier</button>
                {booking.status === "returned" && String(booking.depositStatus ?? "") === "paid" && (
                  <button
                    className={`${styles.buttonAlt} ${styles.full}`}
                    formAction={returnRentalDepositV157}
                    type="submit"
                  >
                    Rendre la caution · {money(Number(booking.depositAmount ?? 0))}
                  </button>
                )}
              </div>
            </form>
          ))}
        </div>
      </main>
    </DashboardShell>
  );
}
