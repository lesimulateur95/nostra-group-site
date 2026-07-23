import { setServiceAvailability } from "@/app/actions/service-availability";
import type { ServiceAvailability } from "@/lib/system/service-availability";

import styles from "./service-availability-panel.module.css";

type ServiceAvailabilityPanelProps = {
  title: string;
  description: string;
  services: ServiceAvailability[];
};

export function ServiceAvailabilityPanel({
  title,
  description,
  services,
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

      <div className={styles.grid}>
        {services.map((service) => (
          <article className={styles.card} key={service.serviceKey}>
            <div className={styles.cardTop}>
              <div>
                <h3>{service.label}</h3>
                <p>{service.closedMessage}</p>
              </div>
              <span
                className={
                  service.isOpen ? styles.openStatus : styles.closedStatus
                }
              >
                {service.isOpen ? "OUVERT" : "CLÔTURÉ"}
              </span>
            </div>

            <form action={setServiceAvailability}>
              <input
                type="hidden"
                name="service_key"
                value={service.serviceKey}
              />
              <input
                type="hidden"
                name="is_open"
                value={service.isOpen ? "false" : "true"}
              />
              <button
                className={service.isOpen ? styles.closeButton : styles.openButton}
                type="submit"
              >
                {service.isOpen ? "Clôturer le service" : "Rouvrir le service"}
              </button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
