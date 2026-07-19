import { saveCommissionerRaceBriefing } from "@/app/actions/commissioners";
import { getCommissionerModuleConfigured, getCommissionerRaceBriefing } from "@/lib/backoffice/data";

export default async function CommissionerBriefingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const configured = await getCommissionerModuleConfigured();
  const briefing = configured ? await getCommissionerRaceBriefing() : null;

  return (
    <article className="circuit-document commissioner-document">
      <header className="document-hero">
        <p className="eyebrow">NOSTRA CIRCUIT · COMMISSAIRES</p>
        <h1 className="page-title">🚦 Briefing avant chaque course</h1>
        <p className="document-intro">Le planning est volontairement vide au départ. Les commissaires et le Gérant ajoutent ou modifient les informations en direct. La page se recharge automatiquement toutes les cinq secondes lorsque personne n’écrit dans un champ.</p>
      </header>

      {!configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Le module Commissaires n’est pas encore activé. Le Gérant doit exécuter le code SQL V26 depuis <strong>Dashboard → Membres et rôles</strong>.
        </div>
      )}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le planning de course a été mis à jour.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer le planning. Vérifie que le code SQL V26 a été exécuté.</div>}

      <section className="document-section briefing-template-card commissioner-live-panel">
        <div className="commissioner-section-heading">
          <div>
            <p className="eyebrow">MISE À JOUR EN DIRECT</p>
            <h2>🏁 Planning de l’événement</h2>
          </div>
          {briefing?.updated_at && <small>Dernière modification : {new Date(briefing.updated_at).toLocaleString("fr-FR")}</small>}
        </div>

        <form action={saveCommissionerRaceBriefing} className="commissioner-form commissioner-planning-form">
          <div className="commissioner-form-grid">
            <label className="commissioner-field commissioner-field-wide">
              <span>Nom de l’événement</span>
              <input name="event_title" maxLength={160} defaultValue={briefing?.event_title ?? ""} placeholder="Exemple : Grand Prix de Locmaria" disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Date</span>
              <input type="date" name="event_date" defaultValue={briefing?.event_date ?? ""} disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Ouverture des stands</span>
              <input type="time" name="stands_opening" defaultValue={briefing?.stands_opening ?? ""} disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Qualifications</span>
              <input type="time" name="qualifications_time" defaultValue={briefing?.qualifications_time ?? ""} disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Départ</span>
              <input type="time" name="race_start" defaultValue={briefing?.race_start ?? ""} disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Voiture</span>
              <input name="vehicle" maxLength={160} defaultValue={briefing?.vehicle ?? ""} placeholder="Modèle ou catégorie" disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Nombre de tours</span>
              <input name="lap_count" maxLength={60} defaultValue={briefing?.lap_count ?? ""} placeholder="Exemple : 25" disabled={!configured} />
            </label>
            <label className="commissioner-field">
              <span>Météo</span>
              <input name="weather" maxLength={160} defaultValue={briefing?.weather ?? ""} placeholder="Exemple : sec, pluie légère…" disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide">
              <span>Commissaires présents</span>
              <textarea name="commissioners" rows={3} maxLength={1000} defaultValue={briefing?.commissioners ?? ""} placeholder="Noms des commissaires affectés à la course" disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide">
              <span>Direction de course</span>
              <textarea name="race_direction" rows={2} maxLength={500} defaultValue={briefing?.race_direction ?? ""} placeholder="Nom du responsable et consignes particulières" disabled={!configured} />
            </label>
            <label className="commissioner-field commissioner-field-wide commissioner-live-message-field">
              <span>Annonce en direct</span>
              <textarea name="live_announcement" rows={3} maxLength={2000} defaultValue={briefing?.live_announcement ?? ""} placeholder="Exemple : 🟡 Qualifications dans 10 minutes" disabled={!configured} />
            </label>
          </div>
          <button className="btn" type="submit" disabled={!configured}>Enregistrer le planning en direct</button>
        </form>
      </section>

      <section className="document-section">
        <h2>📻 Annonces radio conseillées</h2>
        <ul className="document-list commissioner-signal-list">
          <li><strong>🟢 Ouverture des stands</strong><span>La piste et les stands sont accessibles.</span></li>
          <li><strong>🟡 Qualifications dans 10 minutes</strong><span>Prévenir les pilotes avant la fermeture des stands.</span></li>
          <li><strong>🔴 Départ reporté</strong><span>Informer immédiatement les pilotes et préciser le nouveau départ dès qu’il est connu.</span></li>
          <li><strong>🏁 Fin de course</strong><span>Annoncer la fin et organiser le retour sécurisé aux stands.</span></li>
        </ul>
      </section>
    </article>
  );
}
