import { redirect } from "next/navigation";

import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnVehicleReservations,
  getVehicleReservationsConfigured,
} from "@/lib/vehicle-reservations/data";

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

const statusLabels: Record<string, string> = {
  pending_validation: "En attente de validation",
  balance_due: "Validée — solde dans le panier",
  paid_full: "Payée intégralement",
  rejected: "Refusée",
  cancelled: "Annulée",
  completed: "Livrée / terminée",
};

export default async function VehicleReservationsProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const [configured, reservations] = await Promise.all([
    getVehicleReservationsConfigured(),
    getOwnVehicleReservations(data.user.id),
  ]);

  return (
    <>
      <ProfileSectionHeader
        eyebrow="NOSTRA MOTORS"
        title="Mes réservations"
        description="Suis l’acompte de 15 %, la validation de la concession et le paiement du solde restant."
      />

      {!configured ? (
        <div className="dashboard-feedback dashboard-feedback-error">
          Le module de réservation doit être activé avec le SQL V93.
        </div>
      ) : (
        <section className="profile-data-section profile-standalone-section">
          <div className="profile-data-heading">
            <div>
              <p className="eyebrow">SUIVI</p>
              <h2>Réservations véhicules</h2>
            </div>
            <span>{reservations.length}</span>
          </div>

          <div className="profile-table-wrap">
            <table className="profile-data-table">
              <thead>
                <tr>
                  <th>Réservation</th>
                  <th>Véhicule</th>
                  <th>Acompte</th>
                  <th>Solde</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-table-cell">
                      Aucune réservation enregistrée.
                    </td>
                  </tr>
                )}
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>
                      <strong>{reservation.reservation_number}</strong>
                      <small className="order-client-note">
                        {new Date(reservation.created_at).toLocaleDateString(
                          "fr-FR",
                        )}
                      </small>
                    </td>
                    <td>
                      {reservation.vehicle_name}
                      <small className="order-client-note">
                        Prix total : {money(reservation.vehicle_price)}
                      </small>
                    </td>
                    <td>{money(reservation.deposit_amount)}</td>
                    <td>
                      {money(
                        reservation.balance_amount + reservation.delivery_fee,
                      )}
                      {reservation.delivery_fee > 0 && (
                        <small className="order-client-note">
                          Livraison incluse : {money(reservation.delivery_fee)}
                        </small>
                      )}
                    </td>
                    <td>
                      <span
                        className={`order-status order-status-${
                          reservation.status === "completed"
                            ? "completed"
                            : reservation.status === "rejected" ||
                                reservation.status === "cancelled"
                              ? "cancelled"
                              : reservation.status === "balance_due"
                                ? "confirmed"
                                : "pending"
                        }`}
                      >
                        {statusLabels[reservation.status] ?? reservation.status}
                      </span>
                      {reservation.admin_note && (
                        <small className="order-client-note">
                          {reservation.admin_note}
                        </small>
                      )}
                      {reservation.final_order_number && (
                        <small className="order-client-note">
                          Commande : {reservation.final_order_number}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
