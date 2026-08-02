import { setVehicleCommerceAvailability } from "@/app/actions/vehicle-reservation-settings";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getVehicleCommerceDashboardState } from "@/lib/vehicle-commerce-settings/data";
import {
  getVehicleReservationCatalogSettings,
  VEHICLE_RESERVATION_CATALOG_LABELS,
  VEHICLE_RESERVATION_CATALOG_TYPES,
} from "@/lib/vehicle-reservation-settings/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehicleCommerceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, reservationState, vehicleState] = await Promise.all([
    searchParams,
    getVehicleReservationCatalogSettings(),
    getVehicleCommerceDashboardState(),
  ]);

  const catalogSettings = new Map(
    reservationState.settings.map((setting) => [
      setting.catalog_type,
      setting.reservations_enabled,
    ]),
  );

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader
        title="Contrôle des véhicules"
        description="Bloque séparément la réservation ou la vente d’un véhicule tout en le laissant visible dans son catalogue."
      />

      {!vehicleState.configured && (
        <section className="dashboard-setup">
          <span className="module-status">Mise à jour nécessaire</span>
          <h2>Activer le contrôle véhicule par véhicule</h2>
          <p>
            Le SQL V127 doit être présent dans Supabase avant d’utiliser cette page.
          </p>
        </section>
      )}

      {(params.vehicle_saved || params.commerce_saved) && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Les autorisations du véhicule ont bien été enregistrées.
        </div>
      )}

      {(params.error || params.commerce_error) && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {(params.error || params.commerce_error) === "setup-v99"
            ? "Le SQL V127 doit être exécuté dans Supabase."
            : (params.error || params.commerce_error) === "forbidden"
              ? "Seule la direction peut modifier ces paramètres."
              : (params.error || params.commerce_error) === "vehicle"
                ? "Le véhicule sélectionné est introuvable."
                : "Impossible d’enregistrer les autorisations du véhicule."}
        </div>
      )}

      {vehicleState.configured && (
        <section className="vehicle-commerce-section-v99">
          <div className="vehicle-commerce-heading-v99">
            <div>
              <span className="eyebrow">CONTRÔLE INDIVIDUEL</span>
              <h2>Réservation et vente véhicule par véhicule</h2>
              <p>
                Chaque véhicule reste visible. Tu peux autoriser ou bloquer sa réservation et sa vente indépendamment.
              </p>
            </div>
            <span className="vehicle-commerce-count-v99">
              {vehicleState.vehicles.length} véhicule(s)
            </span>
          </div>

          {vehicleState.vehicles.length === 0 ? (
            <div className="backoffice-panel vehicle-commerce-empty-v99">
              Aucun véhicule n’est enregistré dans les catalogues.
            </div>
          ) : (
            VEHICLE_RESERVATION_CATALOG_TYPES.map((catalogType) => {
              const vehicles = vehicleState.vehicles.filter(
                (vehicle) => vehicle.catalog_type === catalogType,
              );
              if (vehicles.length === 0) return null;

              const catalogReservationEnabled =
                catalogSettings.get(catalogType) !== false;

              return (
                <article
                  className="backoffice-panel vehicle-commerce-catalog-v99"
                  key={catalogType}
                >
                  <div className="vehicle-commerce-catalog-head-v99">
                    <div>
                      <span className="eyebrow">CATALOGUE</span>
                      <h3>{VEHICLE_RESERVATION_CATALOG_LABELS[catalogType]}</h3>
                    </div>
                    <span
                      className={`reservation-setting-status-v98${
                        catalogReservationEnabled ? " is-enabled" : " is-disabled"
                      }`}
                    >
                      {catalogReservationEnabled
                        ? "Réservation catalogue active"
                        : "Réservation catalogue fermée"}
                    </span>
                  </div>

                  <div className="vehicle-commerce-table-wrap-v99">
                    <table className="vehicle-commerce-table-v99">
                      <thead>
                        <tr>
                          <th>Véhicule</th>
                          <th>État catalogue</th>
                          <th>Réservation</th>
                          <th>Vente / commande</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map((vehicle) => (
                          <tr
                            id={`vehicule-${vehicle.vehicle_id}`}
                            key={vehicle.vehicle_id}
                          >
                            <td>
                              <strong>
                                {vehicle.brand} {vehicle.model}
                              </strong>
                              <small>
                                Identifiant #{vehicle.vehicle_id} · Stock {vehicle.stock_quantity}
                              </small>
                            </td>
                            <td>
                              <span
                                className={`vehicle-commerce-chip-v99${
                                  vehicle.published ? " is-enabled" : " is-muted"
                                }`}
                              >
                                {vehicle.published ? "Visible" : "Non publié"}
                              </span>
                            </td>
                            <td>
                              <div className="vehicle-commerce-control-v99">
                                <span
                                  className={`vehicle-commerce-chip-v99${
                                    vehicle.reservation_enabled
                                      ? " is-enabled"
                                      : " is-disabled"
                                  }`}
                                >
                                  {vehicle.reservation_enabled
                                    ? "Autorisée"
                                    : "Bloquée"}
                                </span>
                                {!catalogReservationEnabled &&
                                  vehicle.reservation_enabled && (
                                    <small>
                                      Le catalogue bloque actuellement la réservation.
                                    </small>
                                  )}
                                <form action={setVehicleCommerceAvailability}>
                                  <input
                                    type="hidden"
                                    name="vehicle_id"
                                    value={vehicle.vehicle_id}
                                  />
                                  <input
                                    type="hidden"
                                    name="reservation_enabled"
                                    value={
                                      vehicle.reservation_enabled ? "false" : "true"
                                    }
                                  />
                                  <input
                                    type="hidden"
                                    name="sale_enabled"
                                    value={vehicle.sale_enabled ? "true" : "false"}
                                  />
                                  <button
                                    className={
                                      vehicle.reservation_enabled
                                        ? "btn btn-danger-v98"
                                        : "btn"
                                    }
                                    type="submit"
                                  >
                                    {vehicle.reservation_enabled
                                      ? "Bloquer la réservation"
                                      : "Autoriser la réservation"}
                                  </button>
                                </form>
                              </div>
                            </td>
                            <td>
                              <div className="vehicle-commerce-control-v99">
                                <span
                                  className={`vehicle-commerce-chip-v99${
                                    vehicle.sale_enabled
                                      ? " is-enabled"
                                      : " is-disabled"
                                  }`}
                                >
                                  {vehicle.sale_enabled ? "Autorisée" : "Bloquée"}
                                </span>
                                <form action={setVehicleCommerceAvailability}>
                                  <input
                                    type="hidden"
                                    name="vehicle_id"
                                    value={vehicle.vehicle_id}
                                  />
                                  <input
                                    type="hidden"
                                    name="reservation_enabled"
                                    value={
                                      vehicle.reservation_enabled ? "true" : "false"
                                    }
                                  />
                                  <input
                                    type="hidden"
                                    name="sale_enabled"
                                    value={vehicle.sale_enabled ? "false" : "true"}
                                  />
                                  <button
                                    className={
                                      vehicle.sale_enabled
                                        ? "btn btn-danger-v98"
                                        : "btn"
                                    }
                                    type="submit"
                                  >
                                    {vehicle.sale_enabled
                                      ? "Bloquer la vente"
                                      : "Autoriser la vente"}
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      <section className="dashboard-setup reservation-settings-note-v98">
        <span className="module-status">À savoir</span>
        <h2>Le véhicule reste visible</h2>
        <p>
          Bloquer la réservation ou la vente ne retire pas le véhicule du catalogue. Les commandes et réservations déjà validées restent intactes.
        </p>
      </section>
    </DashboardShell>
  );
}
