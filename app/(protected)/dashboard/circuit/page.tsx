import { saveCircuitStatus } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCircuitSetting } from "@/lib/backoffice/data";

export default async function CircuitStatusDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const setting = await getCircuitSetting();

  return (
    <DashboardShell>
      <DashboardHeader title="État du circuit" description="Cette information apparaît en haut de toutes les pages du Nostra Circuit dès que tu l’enregistres." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">L’état du circuit a été publié.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer cet état.</div>}

      <section className="dashboard-two-columns dashboard-circuit-columns">
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">🏁</span><div><h2>Modifier l’état</h2><p>Choisis un état, un titre court et un message destiné aux membres.</p></div></div>
          <form action={saveCircuitStatus} className="backoffice-form">
            <label>État<select name="status" defaultValue={setting.status}><option value="open">Ouvert</option><option value="closed">Fermé</option><option value="maintenance">Maintenance</option><option value="reserved">Réservé</option><option value="competition">Compétition en cours</option></select></label>
            <label>Titre affiché<input name="label" defaultValue={setting.label} required maxLength={100} /></label>
            <label className="form-span-2">Message<textarea name="message" defaultValue={setting.message} rows={6} required maxLength={500} /></label>
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
