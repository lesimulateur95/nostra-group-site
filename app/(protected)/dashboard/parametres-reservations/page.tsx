import {
  setAllVehicleReservationCatalogSettings,
  setVehicleReservationCatalogSetting,
} from "@/app/actions/vehicle-reservation-settings";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getVehicleReservationCatalogSettings,
  VEHICLE_RESERVATION_CATALOG_LABELS,
} from "@/lib/vehicle-reservation-settings/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehicleReservationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, state] = await Promise.all([
    searchParams,
    getVehicleReservationCatalogSettings(),
  ]);

  const enabledCount = state.settings.filter(
    (setting) => setting.reservations_enabled,
  ).length;
  const allEnabled = enabledCount === state.settings.length;
  const allDisabled = enabledCount === 0;

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader
        title="Activation des réservations"
        description="Active ou désactive les réservations avec acompte pour l’ensemble de Nostra Motors ou catalogue par catalogue. Les commandes au prix total restent disponibles."
      />

      {!state.configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les paramètres V98</h2>
          <p>
            Exécute le fichier{" "}
            <strong>nostra-v98-activation-reservations-catalogues.sql</strong>{" "}
            dans Supabase.
          </p>
        </section>
      )}

      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Les paramètres de réservation ont bien été enregistrés.
        </div>
      )}

      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "setup-v98"
            ? "Le SQL V98 doit être exécuté dans Supabase."
            : params.error === "forbidden"
              ? "Seule la direction peut modifier ces paramètres."
              : params.error === "catalog"
                ? "Le catalogue sélectionné est invalide."
                : "Impossible d’enregistrer les paramètres de réservation."}
        </div>
      )}

      {state.configured && (
        <>
          <section className="reservation-settings-master-v98 backoffice-panel">
            <div>
              <span className="eyebrow">RÉGLAGE GÉNÉRAL</span>
              <h2>Réservations sur tous les catalogues</h2>
              <p>
                {allEnabled
                  ? "Les réservations avec acompte sont actuellement actives partout."
                  : allDisabled
                    ? "Les réservations avec acompte sont actuellement désactivées partout."
                    : `${enabledCount} catalogue(s) sur ${state.settings.length} acceptent actuellement les réservations.`}
              </p>
            </div>
            <div className="reservation-settings-master-actions-v98">
              <form action={setAllVehicleReservationCatalogSettings}>
                <input type="hidden" name="enabled" value="true" />
                <button className="btn" type="submit" disabled={allEnabled}>
                  Tout activer
                </button>
              </form>
              <form action={setAllVehicleReservationCatalogSettings}>
                <input type="hidden" name="enabled" value="false" />
                <button
                  className="btn btn-danger-v98"
                  type="submit"
                  disabled={allDisabled}
                >
                  Tout désactiver
                </button>
              </form>
            </div>
          </section>

          <section className="reservation-settings-grid-v98">
            {state.settings.map((setting) => {
              const enabled = setting.reservations_enabled;

              return (
                <article
                  className={`backoffice-panel reservation-setting-card-v98${
                    enabled ? " is-enabled" : " is-disabled"
                  }`}
                  key={setting.catalog_type}
                >
                  <div className="reservation-setting-card-head-v98">
                    <div>
                      <span className="eyebrow">CATALOGUE</span>
                      <h2>
                        {VEHICLE_RESERVATION_CATALOG_LABELS[
                          setting.catalog_type
                        ]}
                      </h2>
                    </div>
                    <span
                      className={`reservation-setting-status-v98${
                        enabled ? " is-enabled" : " is-disabled"
                      }`}
                    >
                      {enabled ? "Réservations actives" : "Réservations fermées"}
                    </span>
                  </div>

                  <p>
                    {enabled
                      ? "Les clients peuvent choisir entre réserver avec 15 % d’acompte et commander au prix total."
                      : "Les clients peuvent toujours commander, mais l’option de réservation avec acompte est masquée et bloquée."}
                  </p>

                  <form action={setVehicleReservationCatalogSetting}>
                    <input
                      type="hidden"
                      name="catalog_type"
                      value={setting.catalog_type}
                    />
                    <input
                      type="hidden"
                      name="enabled"
                      value={enabled ? "false" : "true"}
                    />
                    <button
                      className={enabled ? "btn btn-danger-v98" : "btn"}
                      type="submit"
                    >
                      {enabled
                        ? "Désactiver les réservations"
                        : "Activer les réservations"}
                    </button>
                  </form>
                </article>
              );
            })}
          </section>

          <section className="dashboard-setup reservation-settings-note-v98">
            <span className="module-status">À savoir</span>
            <h2>Les commandes restent ouvertes</h2>
            <p>
              La désactivation concerne uniquement les réservations avec acompte.
              Elle ne bloque pas l’achat direct. Les acomptes non payés présents
              dans les paniers du catalogue désactivé sont retirés automatiquement,
              sans toucher aux réservations déjà payées ou en cours de traitement.
            </p>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
