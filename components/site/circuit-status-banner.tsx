import { getCircuitSetting } from "@/lib/backoffice/data";

export async function CircuitStatusBanner() {
  const setting = await getCircuitSetting();
  return (
    <section className={`circuit-status-banner circuit-status-${setting.status}`} aria-label="État actuel du circuit">
      <span className="circuit-status-dot" aria-hidden="true" />
      <div>
        <small>ÉTAT DU CIRCUIT</small>
        <strong>{setting.label}</strong>
        <p>{setting.message}</p>
      </div>
    </section>
  );
}
