import { redirect } from "next/navigation";

import {
  cancelOwnVehicleTradeInRequest,
  submitVehicleTradeInRequest,
} from "@/app/actions/vehicle-trade-ins";
import { OptimizedImageInput } from "@/components/forms/optimized-image-input";
import { formatParisDateTime } from "@/lib/dates/paris";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnVehicleTradeInRequests,
  getVehicleTradeInsConfigured,
} from "@/lib/vehicle-trade-ins/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  new: "Demande reçue",
  reviewing: "Estimation en cours",
  offer_sent: "Offre proposée",
  accepted: "Offre acceptée",
  refused: "Demande refusée",
  converted: "Véhicule repris",
  cancelled: "Demande annulée",
};

function money(value: number | null) {
  if (!value) return "Non renseigné";
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function VehicleTradeInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const [params, configured, requests] = await Promise.all([
    searchParams,
    getVehicleTradeInsConfigured(),
    getOwnVehicleTradeInRequests(data.user.id),
  ]);

  return (
    <>
      <section className="profile-heading">
        <span className="eyebrow">NOSTRA MOTORS</span>
        <h1 className="page-title">Faire reprendre mon véhicule</h1>
        <p className="lead">
          Envoie les informations et les photos de ton véhicule. Nostra Motors
          étudiera le dossier et pourra te proposer un prix de rachat.
        </p>
      </section>

      {!configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Le module de reprise doit être activé avec le SQL V96.
        </div>
      )}
      {params.sent && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Demande <strong>{params.sent}</strong> envoyée à Nostra Motors.
        </div>
      )}
      {params.cancelled && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La demande de reprise a été annulée.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "image-size"
            ? "Une image optimisée est encore trop lourde. Sélectionne-la de nouveau."
            : params.error === "image-type"
              ? "Formats autorisés : JPG, PNG et WEBP."
              : params.error === "too-many"
                ? "Tu peux envoyer jusqu’à 8 photos."
                : params.error === "setup"
                  ? "Le SQL V96 doit être exécuté dans Supabase."
                  : "La demande n’a pas pu être enregistrée. Vérifie le formulaire."}
        </div>
      )}

      {configured && (
        <div className="trade-in-layout-v96">
          <section className="backoffice-panel trade-in-form-panel-v96">
            <div className="dashboard-section-heading dashboard-section-heading-tight">
              <p className="eyebrow">ESTIMATION</p>
              <h2>Informations du véhicule</h2>
              <p>
                L’envoi du formulaire ne garantit pas le rachat. Le prix final
                sera confirmé après contrôle du véhicule.
              </p>
            </div>

            <form action={submitVehicleTradeInRequest} className="backoffice-form">
              <label>
                Marque
                <input name="brand" required placeholder="Porsche" />
              </label>
              <label>
                Modèle
                <input name="model" required placeholder="Panamera" />
              </label>
              <label>
                Version
                <input name="version" placeholder="Turbo S" />
              </label>
              <label>
                Immatriculation
                <input name="registration" placeholder="AA-123-BB" />
              </label>
              <label>
                Kilométrage
                <input name="mileage" type="number" min="0" defaultValue="0" />
              </label>
              <label>
                Année de première mise en circulation
                <input
                  name="first_registration_year"
                  type="number"
                  min="1950"
                  max="2100"
                  placeholder="2022"
                />
              </label>
              <label>
                État général
                <select name="vehicle_condition" defaultValue="good">
                  <option value="excellent">Excellent</option>
                  <option value="very_good">Très bon</option>
                  <option value="good">Bon</option>
                  <option value="fair">Correct</option>
                  <option value="repair">À remettre en état</option>
                </select>
              </label>
              <label>
                Prix souhaité
                <input
                  name="desired_price"
                  inputMode="decimal"
                  placeholder="250 000"
                />
              </label>
              <label>
                Téléphone de contact
                <input name="customer_phone" placeholder="06..." />
              </label>
              <label className="form-span-2">
                Modifications et équipements
                <textarea
                  name="modifications"
                  rows={4}
                  placeholder="Peinture, moteur, jantes, options, préparation..."
                />
              </label>
              <label className="form-span-2">
                Description complète
                <textarea
                  name="description"
                  rows={6}
                  minLength={10}
                  required
                  placeholder="État mécanique, défauts connus, entretien, historique..."
                />
              </label>
              <label className="form-span-2">
                Photos du véhicule — 8 maximum
                <OptimizedImageInput
                  name="images"
                  maxFiles={8}
                  targetKilobytes={800}
                />
              </label>
              <button type="submit" className="btn form-span-2">
                Envoyer la demande de reprise
              </button>
            </form>
          </section>

          <section className="backoffice-panel">
            <div className="dashboard-section-heading dashboard-section-heading-tight">
              <p className="eyebrow">SUIVI</p>
              <h2>Mes demandes</h2>
            </div>

            <div className="trade-in-own-list-v96">
              {requests.length === 0 && (
                <p className="empty-state">Aucune demande de reprise.</p>
              )}
              {requests.map((request) => (
                <article key={request.id} className="trade-in-own-card-v96">
                  <div className="trade-in-card-head-v96">
                    <div>
                      <span className={`request-status trade-in-status-${request.status}`}>
                        {statusLabels[request.status] ?? request.status}
                      </span>
                      <h3>{request.request_number}</h3>
                      <p>
                        {request.brand} {request.model}
                        {request.version ? ` ${request.version}` : ""}
                      </p>
                    </div>
                    <strong>{money(request.proposed_purchase_price)}</strong>
                  </div>

                  {request.images.length > 0 && (
                    <div className="trade-in-images-v96">
                      {request.images.slice(0, 4).map((image) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={image.path} src={image.url} alt="Véhicule proposé" />
                      ))}
                    </div>
                  )}

                  <dl>
                    <div>
                      <dt>Prix souhaité</dt>
                      <dd>{money(request.desired_price)}</dd>
                    </div>
                    <div>
                      <dt>Kilométrage</dt>
                      <dd>{request.mileage.toLocaleString("fr-FR")} km</dd>
                    </div>
                    <div>
                      <dt>Responsable</dt>
                      <dd>{request.assigned_staff || "Non attribué"}</dd>
                    </div>
                    {request.appointment_at && (
                      <div>
                        <dt>Rendez-vous de contrôle</dt>
                        <dd>
                          {formatParisDateTime(request.appointment_at)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {request.admin_note && (
                    <div className="reservation-reason">
                      <span>Message de Nostra Motors</span>
                      <p>{request.admin_note}</p>
                    </div>
                  )}

                  {["new", "reviewing", "offer_sent"].includes(request.status) && (
                    <form action={cancelOwnVehicleTradeInRequest}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button type="submit" className="danger-button">
                        Annuler ma demande
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
