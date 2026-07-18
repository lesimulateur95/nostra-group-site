import { saveCircuitStatus } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCircuitSetting } from "@/lib/backoffice/data";

const STATUS_OPTIONS = [
  { value: "open", label: "Ouvert", description: "Le circuit accueille normalement les membres." },
  { value: "closed", label: "Fermé", description: "Le circuit est fermé au public et aux pilotes." },
  { value: "maintenance", label: "Maintenance", description: "La piste ou les installations sont en maintenance." },
  { value: "reserved", label: "Réservé", description: "Le circuit est réservé pour une activité privée." },
  { value: "competition", label: "Compétition en cours", description: "Une compétition officielle est actuellement organisée." },
] as const;

export default async function CircuitStatusDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const setting = await getCircuitSetting();
  const selectedStatus = STATUS_OPTIONS.some((option) => option.value === setting.status) ? setting.status : "closed";

  return (
    <DashboardShell>
      <DashboardHeader title="État du circuit" description="Cette information apparaît en haut de toutes les pages du Nostra Circuit dès que tu l’enregistres." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">L’état du circuit a été publié.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer cet état.</div>}

      <section className="dashboard-two-columns dashboard-circuit-columns">
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">🏁</span><div><h2>Modifier l’état</h2><p>Choisis un état, un titre court et un message destiné aux membres.</p></div></div>
          <form action={saveCircuitStatus} className="backoffice-form" autoComplete="off">
            <fieldset className="status-choice-fieldset form-span-2">
              <legend>État du circuit</legend>
              <div className="status-choice-grid">
                {STATUS_OPTIONS.map((option) => (
                  <label className="status-choice" key={option.value}>
                    <input type="radio" name="circuit_status" value={option.value} defaultChecked={selectedStatus === option.value} />
                    <span className="status-choice-card">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="form-span-2">Titre affiché<input name="circuit_label" defaultValue={setting.label} required maxLength={100} /></label>
            <label className="form-span-2">Message<textarea name="circuit_message" defaultValue={setting.message} rows={6} required maxLength={500} /></label>
            <button className="btn" type="submit">Publier l’état du circuit</button>
          </form>
        </article>

        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">◉</span><div><h2>Aperçu en direct</h2><p>Voici ce que les membres verront.</p></div></div>
          <div className={`circuit-status-banner circuit-status-${setting.status}`}>
            <span className="circuit-status-dot" />
            <div><small>ÉTAT DU CIRCUIT</small><strong>{setting.label}</strong><p>{setting.message}</p></div>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
