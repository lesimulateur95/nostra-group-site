import { reviewVehicleReservation } from "@/app/actions/orders";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getVehicleReservations,
  getVehicleReservationsConfigured,
  type VehicleReservation,
} from "@/lib/vehicle-reservations/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

const statusLabels: Record<string, string> = {
  pending_validation: "Acompte payé — à valider",
  balance_due: "Validée — solde au panier",
  paid_full: "Payée intégralement",
  rejected: "Refusée",
  cancelled: "Annulée",
  completed: "Livrée / terminée",
};

export default async function VehicleReservationsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, configured] = await Promise.all([
    searchParams,
    getVehicleReservationsConfigured(),
  ]);
  const reservations = configured ? await getVehicleReservations() : [];
  const active = reservations.filter((reservation) =>
    ["pending_validation", "balance_due", "paid_full"].includes(
      reservation.status,
    ),
  );
  const archived = reservations.filter(
    (reservation) => !active.includes(reservation),
  );

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Réservations véhicules"
        description="Valide les acomptes de 15 %. Une validation ajoute automatiquement les 85 % restants dans le panier du client."
      />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les réservations véhicules</h2>
          <p>
            Exécute le fichier <strong>vehicle-reservations-v93.sql</strong> dans
            Supabase, puis recharge la page.
          </p>
        </section>
      )}

      {params.approved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Réservation validée : le solde a été ajouté au panier du client.
        </div>
      )}
      {params.rejected && (
        <div className="dashboard-feedback">
          Réservation refusée : le véhicule est revenu dans le stock.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Impossible de traiter cette réservation. Vérifie son statut ou le SQL
          V93.
        </div>
      )}

      {configured && (
        <>
          <section className="reservation-admin-summary">
            <article>
              <span>À valider</span>
              <strong>
                {
                  reservations.filter(
                    (item) => item.status === "pending_validation",
                  ).length
                }
              </strong>
            </article>
            <article>
              <span>Soldes à payer</span>
              <strong>
                {
                  reservations.filter((item) => item.status === "balance_due")
                    .length
                }
              </strong>
            </article>
            <article>
              <span>Payées intégralement</span>
              <strong>
                {
                  reservations.filter((item) => item.status === "paid_full")
                    .length
                }
              </strong>
            </article>
          </section>

          <section className="orders-admin-list">
            {active.length === 0 && (
              <div className="backoffice-panel empty-state">
                Aucune réservation active.
              </div>
            )}
            {active.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
              />
            ))}
          </section>

          {archived.length > 0 && (
            <section className="processed-reservations">
              <div className="dashboard-section-heading dashboard-section-heading-tight">
                <p className="eyebrow">HISTORIQUE</p>
                <h2>Réservations terminées, annulées ou refusées</h2>
              </div>
              <div className="orders-admin-list">
                {archived.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}

function ReservationCard({
  reservation,
}: {
  reservation: VehicleReservation;
}) {
  const canReview = ["pending_validation", "balance_due"].includes(
    reservation.status,
  );
  const totalBalance = reservation.balance_amount + reservation.delivery_fee;

  return (
    <article className="backoffice-panel order-admin-card">
      <div className="order-admin-head">
        <div>
          <span
            className={`request-status order-status-${
              reservation.status === "rejected" ||
              reservation.status === "cancelled"
                ? "cancelled"
                : reservation.status === "completed"
                  ? "completed"
                  : reservation.status === "balance_due"
                    ? "confirmed"
                    : "pending"
            }`}
          >
            {statusLabels[reservation.status] ?? reservation.status}
          </span>
          <h2>{reservation.reservation_number}</h2>
          <p>
            <strong>{reservation.customer_name}</strong> · {reservation.vehicle_name}
            {" · "}
            {new Date(reservation.created_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <strong className="order-admin-total">
          {money(reservation.vehicle_price)}
        </strong>
      </div>

      <div className="order-items-list">
        <div>
          <span>Acompte payé (15 %)</span>
          <strong>{money(reservation.deposit_amount)}</strong>
        </div>
        <div>
          <span>Solde véhicule (85 %)</span>
          <strong>{money(reservation.balance_amount)}</strong>
        </div>
        <div>
          <span>
            Livraison : {reservation.delivery_mode === "home" ? "Domicile" : "Showroom"}
          </span>
          <strong>{money(reservation.delivery_fee)}</strong>
        </div>
        <div>
          <span>Montant ajouté au panier après validation</span>
          <strong>{money(totalBalance)}</strong>
        </div>
      </div>

      {reservation.delivery_mode === "home" && (
        <div className="reservation-reason">
          <span>Livraison à domicile</span>
          <p>
            {reservation.delivery_address || "Adresse non renseignée"}
            {reservation.delivery_phone
              ? ` · Téléphone : ${reservation.delivery_phone}`
              : ""}
          </p>
        </div>
      )}

      {reservation.final_order_number && (
        <div className="reservation-reason">
          <span>Commande finale</span>
          <p>{reservation.final_order_number}</p>
        </div>
      )}

      {reservation.admin_note && (
        <div className="reservation-reason">
          <span>Message au client</span>
          <p>{reservation.admin_note}</p>
        </div>
      )}

      {canReview && (
        <form
          action={reviewVehicleReservation}
          className="backoffice-form homologation-review-form"
        >
          <input type="hidden" name="id" value={reservation.id} />
          <label className="form-span-2">
            Message visible par le client
            <textarea
              name="admin_note"
              rows={3}
              defaultValue={reservation.admin_note ?? ""}
              placeholder="Exemple : réservation validée, merci de régler le solde depuis votre panier."
            />
          </label>
          <div className="dashboard-inline-actions form-span-2">
            <button className="btn" type="submit" name="decision" value="approve">
              {reservation.status === "balance_due"
                ? "Remettre le solde dans le panier"
                : "Valider et ajouter le solde au panier"}
            </button>
            <button
              className="danger-button"
              type="submit"
              name="decision"
              value="reject"
            >
              Refuser et rendre le stock
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
