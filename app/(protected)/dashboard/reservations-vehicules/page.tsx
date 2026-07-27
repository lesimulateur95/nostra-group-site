import { reviewVehicleReservation } from "@/app/actions/orders";
import { updateVehicleReservationFollowUp } from "@/app/actions/vehicle-reservations";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { formatParisDateTime, toParisDateTimeLocal } from "@/lib/dates/paris";
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
  preparing: "Véhicule en préparation",
  ready: "Véhicule prêt",
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
    [
      "pending_validation",
      "balance_due",
      "paid_full",
      "preparing",
      "ready",
    ].includes(reservation.status),
  );
  const archived = reservations.filter(
    (reservation) => !active.includes(reservation),
  );
  const overdue = reservations.filter(
    (reservation) =>
      reservation.status === "balance_due" &&
      reservation.payment_due_at &&
      new Date(reservation.payment_due_at).getTime() < Date.now(),
  ).length;

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Réservations véhicules"
        description="Valide l’acompte, suis le paiement du solde, attribue un commercial puis accompagne le véhicule jusqu’à sa livraison."
      />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer le suivi V96 des réservations</h2>
          <p>
            Exécute le fichier <strong>nostra-v96-recrutement-reservations-reprise.sql</strong>{" "}
            dans Supabase. Le SQL V93 doit déjà être installé.
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
      {params.followup_saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Suivi de la réservation mis à jour.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "setup-v96"
            ? "Le SQL V96 doit être exécuté dans Supabase."
            : params.error === "status"
              ? "Ce statut ne peut pas être appliqué à cette réservation."
              : "Impossible de traiter cette réservation. Vérifie son statut et la configuration Supabase."}
        </div>
      )}

      {configured && (
        <>
          <section className="reservation-admin-summary reservation-summary-v96">
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
              <span>En préparation</span>
              <strong>
                {
                  reservations.filter((item) =>
                    ["paid_full", "preparing", "ready"].includes(item.status),
                  ).length
                }
              </strong>
            </article>
            <article>
              <span>Échéances dépassées</span>
              <strong>{overdue}</strong>
            </article>
          </section>

          <section className="orders-admin-list">
            {active.length === 0 && (
              <div className="backoffice-panel empty-state">
                Aucune réservation active.
              </div>
            )}
            {active.map((reservation) => (
              <ReservationCard key={reservation.id} reservation={reservation} />
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

function ReservationCard({ reservation }: { reservation: VehicleReservation }) {
  const canReview = ["pending_validation", "balance_due"].includes(
    reservation.status,
  );
  const canProgress = ["paid_full", "preparing", "ready", "completed"].includes(
    reservation.status,
  );
  const totalBalance = reservation.balance_amount + reservation.delivery_fee;
  const deadlineOverdue =
    reservation.status === "balance_due" &&
    reservation.payment_due_at &&
    new Date(reservation.payment_due_at).getTime() < Date.now();

  return (
    <article className="backoffice-panel order-admin-card reservation-card-v96">
      <div className="order-admin-head">
        <div>
          <span
            className={`request-status order-status-${
              reservation.status === "rejected" ||
              reservation.status === "cancelled"
                ? "cancelled"
                : reservation.status === "completed"
                  ? "completed"
                  : reservation.status === "balance_due" ||
                      reservation.status === "ready"
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
            {formatParisDateTime(reservation.created_at)}
          </p>
        </div>
        <strong className="order-admin-total">
          {money(reservation.vehicle_price)}
        </strong>
      </div>

      <div className="order-items-list reservation-money-grid-v96">
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
          <span>Montant du solde avec livraison</span>
          <strong>{money(totalBalance)}</strong>
        </div>
      </div>

      <div className="reservation-followup-summary-v96">
        <div>
          <span>Commercial responsable</span>
          <strong>{reservation.assigned_staff || "Non attribué"}</strong>
        </div>
        <div className={deadlineOverdue ? "reservation-deadline-overdue-v96" : ""}>
          <span>Échéance du solde</span>
          <strong>
            {reservation.payment_due_at
              ? formatParisDateTime(reservation.payment_due_at)
              : "Non définie"}
          </strong>
        </div>
        <div>
          <span>Commande finale</span>
          <strong>{reservation.final_order_number || "Pas encore créée"}</strong>
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

      {reservation.admin_note && (
        <div className="reservation-reason">
          <span>Message visible par le client</span>
          <p>{reservation.admin_note}</p>
        </div>
      )}
      {reservation.internal_note && (
        <div className="reservation-reason reservation-internal-note-v96">
          <span>Note interne</span>
          <p>{reservation.internal_note}</p>
        </div>
      )}

      {canReview && (
        <form
          action={reviewVehicleReservation}
          className="backoffice-form homologation-review-form"
        >
          <input type="hidden" name="id" value={reservation.id} />
          <label className="form-span-2">
            Message visible par le client lors de la décision
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

      <form action={updateVehicleReservationFollowUp} className="backoffice-form reservation-followup-form-v96">
        <input type="hidden" name="reservation_id" value={reservation.id} />
        <label>
          Commercial responsable
          <input
            name="assigned_staff"
            defaultValue={reservation.assigned_staff ?? ""}
            placeholder="Nom du commercial"
          />
        </label>
        <label>
          Date limite de paiement du solde
          <input
            type="datetime-local"
            name="payment_due_at"
            defaultValue={toParisDateTimeLocal(reservation.payment_due_at)}
          />
        </label>
        {canProgress && (
          <label>
            Étape après paiement
            <select name="status" defaultValue={reservation.status}>
              <option value="paid_full">Paiement intégral reçu</option>
              <option value="preparing">Véhicule en préparation</option>
              <option value="ready">Véhicule prêt</option>
              <option value="completed">Véhicule livré / dossier terminé</option>
            </select>
          </label>
        )}
        <label className="form-span-2">
          Message visible par le client
          <textarea
            name="admin_note"
            rows={3}
            defaultValue={reservation.admin_note ?? ""}
          />
        </label>
        <label className="form-span-2">
          Note interne Nostra Motors
          <textarea
            name="internal_note"
            rows={3}
            defaultValue={reservation.internal_note ?? ""}
            placeholder="Préparation, rendez-vous, documents manquants..."
          />
        </label>
        <button type="submit" className="secondary-button form-span-2">
          Enregistrer le suivi
        </button>
      </form>
    </article>
  );
}
