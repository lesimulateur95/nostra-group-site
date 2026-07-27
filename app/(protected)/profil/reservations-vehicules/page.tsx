import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { formatParisDateTime } from "@/lib/dates/paris";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnVehicleReservations,
  getVehicleReservationsConfigured,
  type VehicleReservation,
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
  preparing: "Véhicule en préparation",
  ready: "Véhicule prêt",
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
        description="Suis chaque étape : acompte, validation, paiement du solde, préparation et livraison."
      />

      {!configured ? (
        <div className="dashboard-feedback dashboard-feedback-error">
          Le suivi détaillé des réservations doit être activé avec le SQL V96.
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

          <div className="profile-reservation-list-v96">
            {reservations.length === 0 && (
              <p className="empty-state">Aucune réservation enregistrée.</p>
            )}
            {reservations.map((reservation) => (
              <ClientReservationCard
                key={reservation.id}
                reservation={reservation}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ClientReservationCard({
  reservation,
}: {
  reservation: VehicleReservation;
}) {
  const balanceTotal = reservation.balance_amount + reservation.delivery_fee;
  const deadlineOverdue =
    reservation.status === "balance_due" &&
    reservation.payment_due_at &&
    new Date(reservation.payment_due_at).getTime() < Date.now();
  const steps = [
    {
      key: "deposit",
      label: "Acompte payé",
      date: reservation.deposit_paid_at,
      done: true,
    },
    {
      key: "validation",
      label: "Réservation validée",
      date: reservation.validated_at,
      done: Boolean(reservation.validated_at),
    },
    {
      key: "balance-cart",
      label: "Solde disponible au panier",
      date: reservation.balance_added_at,
      done: Boolean(reservation.balance_added_at),
    },
    {
      key: "balance-paid",
      label: "Solde payé",
      date: reservation.balance_paid_at,
      done: Boolean(reservation.balance_paid_at),
    },
    {
      key: "preparing",
      label: "Véhicule en préparation",
      date: reservation.preparation_started_at,
      done:
        Boolean(reservation.preparation_started_at) ||
        ["preparing", "ready", "completed"].includes(reservation.status),
    },
    {
      key: "ready",
      label: "Véhicule prêt",
      date: reservation.ready_at,
      done: Boolean(reservation.ready_at) || ["ready", "completed"].includes(reservation.status),
    },
    {
      key: "delivered",
      label: "Véhicule livré",
      date: reservation.delivered_at,
      done: Boolean(reservation.delivered_at) || reservation.status === "completed",
    },
  ];

  return (
    <article className="profile-reservation-card-v96">
      <div className="profile-reservation-head-v96">
        <div>
          <span
            className={`order-status order-status-${
              reservation.status === "completed"
                ? "completed"
                : reservation.status === "rejected" ||
                    reservation.status === "cancelled"
                  ? "cancelled"
                  : reservation.status === "balance_due" ||
                      reservation.status === "ready"
                    ? "confirmed"
                    : "pending"
            }`}
          >
            {statusLabels[reservation.status] ?? reservation.status}
          </span>
          <h3>{reservation.vehicle_name}</h3>
          <p>{reservation.reservation_number}</p>
        </div>
        <strong>{money(reservation.vehicle_price)}</strong>
      </div>

      <div className="profile-reservation-money-v96">
        <div><span>Acompte versé</span><strong>{money(reservation.deposit_amount)}</strong></div>
        <div><span>Solde avec livraison</span><strong>{money(balanceTotal)}</strong></div>
        <div><span>Commercial</span><strong>{reservation.assigned_staff || "En cours d’attribution"}</strong></div>
        <div className={deadlineOverdue ? "reservation-deadline-overdue-v96" : ""}>
          <span>Date limite de paiement</span>
          <strong>
            {reservation.payment_due_at
              ? formatParisDateTime(reservation.payment_due_at)
              : "Non définie"}
          </strong>
        </div>
      </div>

      <div className="reservation-timeline-v96">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`reservation-timeline-step-v96${step.done ? " is-done" : ""}`}
          >
            <span aria-hidden="true">{step.done ? "✓" : ""}</span>
            <div>
              <strong>{step.label}</strong>
              <small>
                {step.date
                  ? formatParisDateTime(step.date)
                  : step.done
                    ? "Étape validée"
                    : "En attente"}
              </small>
            </div>
          </div>
        ))}
      </div>

      {reservation.admin_note && (
        <div className="reservation-reason">
          <span>Message de Nostra Motors</span>
          <p>{reservation.admin_note}</p>
        </div>
      )}

      {reservation.status === "balance_due" && (
        <div className="dashboard-inline-actions">
          <Link href="/profil" className="btn">
            Régler le solde depuis mon panier
          </Link>
        </div>
      )}
      {reservation.final_order_number && (
        <p className="order-client-note">
          Commande finale : <strong>{reservation.final_order_number}</strong>
        </p>
      )}
    </article>
  );
}
