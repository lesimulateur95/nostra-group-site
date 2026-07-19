import { saveCommissionerRaceBriefing } from "@/app/actions/commissioners";
import { LiveRacePlanning } from "@/components/circuit/live-race-planning";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCommissionerModuleConfigured, getCommissionerRaceBriefing } from "@/lib/backoffice/data";
import { DASHBOARD_ACCESS_SETUP_SQL } from "@/lib/backoffice/dashboard-access-setup-sql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommissionerDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const configured = await getCommissionerModuleConfigured();
  const briefing = configured ? await getCommissionerRaceBriefing() : null;

  return (
    <DashboardShell allowedRoles={["manager", "commissioner"]}>
      <DashboardHeader eyebrow="DIRECTION DE COURSE" title="Planning course en direct" description="Les modifications enregistrées ici apparaissent instantanément dans la partie Nostra Circuit." />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation V30 nécessaire</span>
          <h2>Activer le planning public et le temps réel</h2>
          <details><summary>Afficher le code SQL V30</summary><pre>{DASHBOARD_ACCESS_SETUP_SQL}</pre></details>
        </section>
      )}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le planning en direct a été mis à jour.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer le planning.</div>}

      <section className="backoffice-panel commissioner-live-panel">
        <div className="panel-heading"><span className="panel-icon">🏁</span><div><h2>Informations modifiables</h2><p>Chaque enregistrement est envoyé immédiatement aux citoyens qui regardent la page Planning en direct.</p></div></div>
        <form action={saveCommissionerRaceBriefing} className="commissioner-form commissioner-planning-form">
          <input type="hidden" name="return_to" value="/dashboard/commissaires" />
          <div className="commissioner-form-grid">
            <label className="commissioner-field commissioner-field-wide"><span>Nom de l’événement</span><input name="event_title" maxLength={160} defaultValue={briefing?.event_title ?? ""} placeholder="Exemple : Grand Prix de Locmaria" disabled={!configured} /></label>
            <label className="commissioner-field"><span>Date</span><input type="date" name="event_date" defaultValue={briefing?.event_date ?? ""} disabled={!configured} /></label>
            <label className="commissioner-field"><span>Ouverture des stands</span><input type="time" name="stands_opening" defaultValue={briefing?.stands_opening ?? ""} disabled={!configured} /></label>
            <label className="commissioner-field"><span>Qualifications</span><input type="time" name="qualifications_time" defaultValue={briefing?.qualifications_time ?? ""} disabled={!configured} /></label>
            <label className="commissioner-field"><span>Départ</span><input type="time" name="race_start" defaultValue={briefing?.race_start ?? ""} disabled={!configured} /></label>
            <label className="commissioner-field"><span>Voiture</span><input name="vehicle" maxLength={160} defaultValue={briefing?.vehicle ?? ""} placeholder="Modèle ou catégorie" disabled={!configured} /></label>
            <label className="commissioner-field"><span>Nombre de tours</span><input name="lap_count" maxLength={60} defaultValue={briefing?.lap_count ?? ""} placeholder="Exemple : 25" disabled={!configured} /></label>
            <label className="commissioner-field"><span>Météo</span><input name="weather" maxLength={160} defaultValue={briefing?.weather ?? ""} placeholder="Exemple : sec, pluie légère…" disabled={!configured} /></label>
            <label className="commissioner-field commissioner-field-wide"><span>Commissaires présents</span><textarea name="commissioners" rows={3} maxLength={1000} defaultValue={briefing?.commissioners ?? ""} placeholder="Noms des commissaires affectés" disabled={!configured} /></label>
            <label className="commissioner-field commissioner-field-wide"><span>Direction de course</span><textarea name="race_direction" rows={2} maxLength={500} defaultValue={briefing?.race_direction ?? ""} placeholder="Responsable et consignes" disabled={!configured} /></label>
            <label className="commissioner-field commissioner-field-wide commissioner-live-message-field"><span>Annonce en direct</span><textarea name="live_announcement" rows={3} maxLength={2000} defaultValue={briefing?.live_announcement ?? ""} placeholder="Exemple : 🟡 Qualifications dans 10 minutes" disabled={!configured} /></label>
          </div>
          <button className="btn" type="submit" disabled={!configured}>Publier les modifications en direct</button>
        </form>
      </section>

      <section className="dashboard-live-preview">
        <p className="eyebrow">APERÇU CITOYEN EN TEMPS RÉEL</p>
        <LiveRacePlanning initialPlanning={briefing} />
      </section>
    </DashboardShell>
  );
}
