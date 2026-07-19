import { createCommissionerIncidentReport, deleteCommissionerIncidentReport } from "@/app/actions/commissioners";
import { getCommissionerIncidentReports, getCommissionerModuleConfigured } from "@/lib/backoffice/data";
import { hasDashboardAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export default async function CommissionerIncidentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const configured = await getCommissionerModuleConfigured();
  const reports = configured ? await getCommissionerIncidentReports() : [];
  const managerAccess = await hasDashboardAccess(authData.user);

  return (
    <article className="circuit-document commissioner-document">
      <header className="document-hero">
        <p className="eyebrow">NOSTRA CIRCUIT · COMMISSAIRES</p>
        <h1 className="page-title">🚨 Incidents circuit</h1>
        <p className="document-intro">Les commissaires et le Gérant peuvent rédiger un rapport officiel après chaque accident, comportement dangereux ou intervention sur le circuit.</p>
      </header>

      {!configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Le module Commissaires n’est pas encore activé. Le Gérant doit exécuter le code SQL V26 depuis <strong>Dashboard → Membres et rôles</strong>.
        </div>
      )}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le rapport d’incident a été enregistré.</div>}
      {params.deleted && <div className="dashboard-feedback dashboard-feedback-success">Le rapport a été supprimé.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Le rapport n’a pas pu être enregistré. Vérifie les champs et l’activation SQL V26.</div>}

      <section className="document-section commissioner-live-panel">
        <div className="commissioner-section-heading">
          <div><p className="eyebrow">NOUVEAU COMPTE RENDU</p><h2>📋 Formulaire de rapport d’incident</h2></div>
        </div>
        <form action={createCommissionerIncidentReport} className="commissioner-form">
          <div className="commissioner-form-grid">
            <label className="commissioner-field">
              <span>Date de l’incident *</span>
              <input type="date" name="incident_date" required disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Heure de l’incident *</span>
              <input type="time" name="incident_time" required disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Session ou championnat *</span>
              <input name="session_name" required maxLength={180} placeholder="Exemple : Qualifications F1" disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Zone du circuit *</span>
              <input name="circuit_zone" required maxLength={180} placeholder="Exemple : virage 3" disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide">
              <span>Pilotes, équipes ou personnes impliqués *</span>
              <textarea name="people_involved" required rows={2} maxLength={1000} disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide">
              <span>Description factuelle de l’incident *</span>
              <textarea name="factual_description" required rows={5} maxLength={5000} placeholder="Décris uniquement les faits observés, dans l’ordre." disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide">
              <span>Signalisation et intervention effectuées *</span>
              <textarea name="intervention" required rows={4} maxLength={5000} placeholder="Drapeau utilisé, arrêt de session, assistance apportée…" disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide">
              <span>Témoins ou commissaires présents</span>
              <textarea name="witnesses" rows={2} maxLength={1500} disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide">
              <span>Décision de la Direction de Course</span>
              <textarea name="race_direction_decision" rows={3} maxLength={3000} disabled={!configured} />
            </label>
          </div>
          <button className="btn" type="submit" disabled={!configured}>Enregistrer le rapport</button>
        </form>
      </section>

      <section className="document-section commissioner-reports-section">
        <div className="commissioner-section-heading">
          <div><p className="eyebrow">HISTORIQUE PARTAGÉ</p><h2>Rapports enregistrés</h2></div>
          <span className="commissioner-count-badge">{reports.length}</span>
        </div>
        {reports.length === 0 && <div className="empty-official-section"><p>Aucun rapport d’incident enregistré.</p></div>}
        <div className="commissioner-report-list">
          {reports.map((report) => (
            <details className="commissioner-report-card" key={report.id}>
              <summary>
                <span><strong>{new Date(`${report.incident_date}T${report.incident_time}`).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</strong> · {report.session_name}</span>
                <small>{report.circuit_zone} · rapporté par {report.author_name}</small>
              </summary>
              <div className="commissioner-report-body">
                <dl>
                  <div><dt>Personnes impliquées</dt><dd>{report.people_involved}</dd></div>
                  <div><dt>Description</dt><dd>{report.factual_description}</dd></div>
                  <div><dt>Intervention</dt><dd>{report.intervention}</dd></div>
                  <div><dt>Témoins</dt><dd>{report.witnesses || "Non renseigné"}</dd></div>
                  <div><dt>Décision Direction de Course</dt><dd>{report.race_direction_decision || "En attente"}</dd></div>
                </dl>
                {(managerAccess || report.created_by === authData.user?.id) && (
                  <form action={deleteCommissionerIncidentReport}>
                    <input type="hidden" name="id" value={report.id} />
                    <button className="danger-link-button" type="submit">Supprimer ce rapport</button>
                  </form>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>
    </article>
  );
}
