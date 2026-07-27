import Link from "next/link";

import {
  convertVehicleTradeInToUsedVehicle,
  reviewVehicleTradeInRequest,
} from "@/app/actions/vehicle-trade-ins";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { formatParisDateTime, toParisDateTimeLocal } from "@/lib/dates/paris";
import {
  getVehicleTradeInRequests,
  getVehicleTradeInsConfigured,
  type VehicleTradeInRequest,
} from "@/lib/vehicle-trade-ins/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  new: "Nouvelle demande",
  reviewing: "Estimation en cours",
  offer_sent: "Offre envoyée",
  accepted: "Offre acceptée",
  refused: "Refusée",
  converted: "Ajoutée aux véhicules rachetés",
  cancelled: "Annulée",
};

const conditionLabels: Record<string, string> = {
  excellent: "Excellent état",
  very_good: "Très bon état",
  good: "Bon état",
  fair: "État correct",
  repair: "À remettre en état",
};

function money(value: number | null) {
  return value
    ? value.toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      })
    : "—";
}


export default async function VehicleTradeInDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, configured, requests] = await Promise.all([
    searchParams,
    getVehicleTradeInsConfigured(),
    getVehicleTradeInRequests(),
  ]);
  const active = requests.filter((request) =>
    ["new", "reviewing", "offer_sent", "accepted"].includes(request.status),
  );
  const archived = requests.filter((request) => !active.includes(request));

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Demandes de reprise"
        description="Étudie les véhicules proposés par les clients, envoie une offre et transforme les dossiers acceptés en véhicules d’occasion."
      />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les demandes de reprise V96</h2>
          <p>
            Exécute le fichier <strong>nostra-v96-recrutement-reservations-reprise.sql</strong>{" "}
            dans Supabase.
          </p>
        </section>
      )}
      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Demande de reprise mise à jour.
        </div>
      )}
      {params.converted && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La demande <strong>{params.converted}</strong> a été transformée en
          véhicule racheté. Elle est enregistrée non publiée dans le catalogue
          d’occasion.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "status"
            ? "La demande doit être acceptée avec un prix de rachat et un prix de revente avant sa transformation."
            : params.error === "price"
              ? "Renseigne un prix de rachat pour envoyer une offre, ainsi qu’un prix de revente avant d’accepter le dossier."
            : params.error === "registration"
              ? "Cette immatriculation existe déjà dans les véhicules rachetés."
              : params.error === "setup"
                ? "Le SQL V96 ou le module Véhicules rachetés V92 doit être activé."
                : "Impossible de traiter cette demande."}
        </div>
      )}

      {configured && (
        <>
          <section className="reservation-admin-summary trade-in-summary-v96">
            <article>
              <span>Nouvelles</span>
              <strong>{requests.filter((item) => item.status === "new").length}</strong>
            </article>
            <article>
              <span>En estimation</span>
              <strong>
                {requests.filter((item) => item.status === "reviewing").length}
              </strong>
            </article>
            <article>
              <span>Offres envoyées</span>
              <strong>
                {requests.filter((item) => item.status === "offer_sent").length}
              </strong>
            </article>
            <article>
              <span>À convertir</span>
              <strong>
                {requests.filter((item) => item.status === "accepted").length}
              </strong>
            </article>
          </section>

          <section className="orders-admin-list trade-in-admin-list-v96">
            {active.length === 0 && (
              <div className="backoffice-panel empty-state">
                Aucune demande de reprise active.
              </div>
            )}
            {active.map((request) => (
              <TradeInDashboardCard key={request.id} request={request} />
            ))}
          </section>

          {archived.length > 0 && (
            <section className="processed-reservations">
              <div className="dashboard-section-heading dashboard-section-heading-tight">
                <p className="eyebrow">HISTORIQUE</p>
                <h2>Demandes terminées</h2>
              </div>
              <div className="orders-admin-list trade-in-admin-list-v96">
                {archived.map((request) => (
                  <TradeInDashboardCard key={request.id} request={request} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}

function TradeInDashboardCard({ request }: { request: VehicleTradeInRequest }) {
  const convertible =
    request.status === "accepted" &&
    Number(request.proposed_purchase_price) > 0 &&
    Number(request.planned_resale_price) > 0;

  return (
    <article className="backoffice-panel trade-in-admin-card-v96">
      <div className="order-admin-head">
        <div>
          <span className={`request-status trade-in-status-${request.status}`}>
            {statusLabels[request.status] ?? request.status}
          </span>
          <h2>{request.request_number}</h2>
          <p>
            <strong>{request.customer_name}</strong> · {request.brand} {request.model}
            {request.version ? ` ${request.version}` : ""}
            {" · "}
            {formatParisDateTime(request.created_at)}
          </p>
        </div>
        <div className="trade-in-price-summary-v96">
          <span>Souhait client</span>
          <strong>{money(request.desired_price)}</strong>
        </div>
      </div>

      {request.images.length > 0 && (
        <div className="trade-in-images-v96 trade-in-images-admin-v96">
          {request.images.map((image) => (
            <a key={image.path} href={image.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="Véhicule proposé à la reprise" />
            </a>
          ))}
        </div>
      )}

      <div className="trade-in-details-grid-v96">
        <div><span>Immatriculation</span><strong>{request.registration || "Non renseignée"}</strong></div>
        <div><span>Kilométrage</span><strong>{request.mileage.toLocaleString("fr-FR")} km</strong></div>
        <div><span>Année</span><strong>{request.first_registration_year || "Non renseignée"}</strong></div>
        <div><span>État</span><strong>{conditionLabels[request.vehicle_condition] ?? request.vehicle_condition}</strong></div>
        <div><span>Téléphone</span><strong>{request.customer_phone || "Non renseigné"}</strong></div>
        <div><span>E-mail</span><strong>{request.customer_email || "Non renseigné"}</strong></div>
      </div>

      <div className="recruitment-answers-v96">
        <div>
          <span>Description</span>
          <p>{request.description}</p>
        </div>
        {request.modifications && (
          <div>
            <span>Modifications et équipements</span>
            <p>{request.modifications}</p>
          </div>
        )}
      </div>

      {request.status !== "converted" && (
        <form action={reviewVehicleTradeInRequest} className="backoffice-form">
          <input type="hidden" name="request_id" value={request.id} />
          <label>
            Statut
            <select name="status" defaultValue={request.status}>
              <option value="new">Nouvelle demande</option>
              <option value="reviewing">Estimation en cours</option>
              <option value="offer_sent">Offre envoyée</option>
              <option value="accepted">Offre acceptée</option>
              <option value="refused">Refusée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </label>
          <label>
            Commercial responsable
            <input
              name="assigned_staff"
              defaultValue={request.assigned_staff ?? ""}
            />
          </label>
          <label>
            Prix de rachat proposé
            <input
              name="proposed_purchase_price"
              inputMode="decimal"
              defaultValue={request.proposed_purchase_price ?? ""}
              placeholder="200 000"
            />
          </label>
          <label>
            Prix de revente prévu
            <input
              name="planned_resale_price"
              inputMode="decimal"
              defaultValue={request.planned_resale_price ?? ""}
              placeholder="260 000"
            />
          </label>
          <label>
            Rendez-vous de contrôle
            <input
              type="datetime-local"
              name="appointment_at"
              defaultValue={toParisDateTimeLocal(request.appointment_at)}
            />
          </label>
          <label className="form-span-2">
            Message visible par le client
            <textarea
              name="admin_note"
              rows={4}
              defaultValue={request.admin_note ?? ""}
              placeholder="Prix proposé, conditions et rendez-vous..."
            />
          </label>
          <label className="form-span-2">
            Notes internes
            <textarea
              name="internal_note"
              rows={4}
              defaultValue={request.internal_note ?? ""}
            />
          </label>
          <button type="submit" className="btn form-span-2">
            Enregistrer le dossier
          </button>
        </form>
      )}

      {convertible && (
        <form action={convertVehicleTradeInToUsedVehicle} className="trade-in-convert-v96">
          <input type="hidden" name="request_id" value={request.id} />
          <div>
            <strong>Transformation prête</strong>
            <p>
              Le véhicule sera créé dans les rachats avec un prix d’achat de {" "}
              {money(request.proposed_purchase_price)} et un prix de revente de {" "}
              {money(request.planned_resale_price)}. Il restera non publié pour
              permettre un dernier contrôle.
            </p>
          </div>
          <button type="submit" className="btn">
            Transformer en véhicule racheté
          </button>
        </form>
      )}

      {request.converted_vehicle_id && (
        <div className="dashboard-inline-actions">
          <Link href="/dashboard/occasion/rachats" className="secondary-button">
            Ouvrir les véhicules rachetés
          </Link>
          <Link href="/dashboard/occasion/catalogue" className="secondary-button">
            Préparer la publication
          </Link>
        </div>
      )}
    </article>
  );
}
