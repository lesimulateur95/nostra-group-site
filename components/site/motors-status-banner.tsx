import { getMotorsSetting } from "@/lib/backoffice/data";

export async function MotorsStatusBanner() {
  const setting = await getMotorsSetting();
  return (
    <section className={`circuit-status-banner circuit-status-${setting.status}`} aria-label="État actuel de Nostra Motors">
      <span className="circuit-status-dot" aria-hidden="true" />
      <div>
        <small>ÉTAT DE NOSTRA MOTORS</small>
        <strong>{setting.label}</strong>
        <p>{setting.message}</p>
      </div>
    </section>
  );
}
