import {
  saveServiceAvailabilitySettings,
  setServiceAvailability,
} from "@/app/actions/service-availability";
import type {
  ServiceAvailability,
  ServiceAvailabilityHistory,
} from "@/lib/system/service-availability";

import styles from "./service-availability-panel.module.css";

type ServiceAvailabilityPanelProps = {
  title: string;
  description: string;
  services: ServiceAvailability[];
  canManage: boolean;
  history?: ServiceAvailabilityHistory[];
};

function formatParisDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function changeLabel(item: ServiceAvailabilityHistory): string {
  if (item.changeType === "opened") return "Service rouvert";
  if (item.changeType === "closed") return "Service clôturé";
  return "Message ou date modifié";
}

export function ServiceAvailabilityPanel({
  title,
  description,
  services,
  canManage,
  history,
}: ServiceAvailabilityPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="service-control-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>OUVERTURE AU PUBLIC</p>
          <h2 id="service-control-title">{title}</h2>
        </div>
        <p>{description}</p>
      </div>

      {!canManage ? (
        <p className={styles.readOnlyNotice}>
          Mode consultation : seuls la Direction, les gérants et les managers
          peuvent modifier ces réglages.
        </p>
      ) : null}

      <div className={styles.grid}>
        {services.map((service) => {
          const statusLabel = service.closedByMaster
            ? "SUSPENDU"
            : service.configuredOpen
              ? "OUVERT"
              : "CLÔTURÉ";

          return (
            <article
              className={`${styles.card} ${service.isMaster ? styles.masterCard : ""}`}
              key={service.serviceKey}
            >
              <div className={styles.cardTop}>
                <div>
                  {service.isMaster ? (
                    <p className={styles.masterEyebrow}>COMMANDE GÉNÉRALE</p>
                  ) : null}
                  <h3>{service.label}</h3>
                  {service.closedByMaster ? (
                    <p className={styles.masterWarning}>
                      Suspendu par la fermeture générale. Son réglage individuel
                      est conservé.
                    </p>
                  ) : null}
                </div>
                <span
                  className={
                    service.closedByMaster
                      ? styles.suspendedStatus
                      : service.configuredOpen
                        ? styles.openStatus
                        : styles.closedStatus
                  }
                >
                  {statusLabel}
                </span>
              </div>

              <form action={saveServiceAvailabilitySettings} className={styles.settingsForm}>
                <input type="hidden" name="service_key" value={service.serviceKey} />

                <label>
                  Message affiché pendant la fermeture
                  <textarea
                    name="closed_message"
                    defaultValue={service.configuredClosedMessage}
                    maxLength={500}
                    rows={3}
                    disabled={!canManage}
                    required
                  />
                </label>

                <label>
                  Date de réouverture prévue
                  <input
                    type="datetime-local"
                    name="reopens_at"
                    defaultValue={formatParisDateTimeInput(
                      service.configuredReopensAt,
                    )}
                    disabled={!canManage}
                  />
                  <small>Laisse vide si aucune date n’est prévue.</small>
                </label>

                {canManage ? (
                  <button className={styles.saveButton} type="submit">
                    Enregistrer le message et la date
                  </button>
                ) : null}
              </form>

              {canManage ? (
                <form action={setServiceAvailability}>
                  <input type="hidden" name="service_key" value={service.serviceKey} />
                  <input
                    type="hidden"
                    name="is_open"
                    value={service.configuredOpen ? "false" : "true"}
                  />
                  <button
                    className={
                      service.configuredOpen ? styles.closeButton : styles.openButton
                    }
                    type="submit"
                  >
                    {service.configuredOpen
                      ? service.isMaster
                        ? "Clôturer tous les services"
                        : "Clôturer le service"
                      : service.isMaster
                        ? "Rouvrir les services"
                        : "Rouvrir le service"}
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>

      {history !== undefined ? (
        <section className={styles.history} aria-labelledby="service-history-title">
          <div className={styles.historyHeading}>
            <div>
              <p className={styles.eyebrow}>TRAÇABILITÉ</p>
              <h3 id="service-history-title">Dernières modifications</h3>
            </div>
            <p>Les 20 dernières actions réalisées par la Direction.</p>
          </div>

          <div className={styles.historyList}>
            {history.length === 0 ? (
              <p className={styles.emptyHistory}>
                Aucune modification n’est encore enregistrée.
              </p>
            ) : null}
            {history.map((item) => (
              <article className={styles.historyItem} key={item.id}>
                <div>
                  <strong>{item.serviceLabel}</strong>
                  <span>{changeLabel(item)}</span>
                </div>
                <div className={styles.historyMeta}>
                  <span>{item.changedByName}</span>
                  <time dateTime={item.changedAt}>
                    {formatHistoryDate(item.changedAt)}
                  </time>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
