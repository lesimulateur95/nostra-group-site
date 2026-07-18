import { deleteEvent, saveEvent } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getEvents } from "@/lib/backoffice/data";

function localInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export default async function EventsDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const events = await getEvents(true);

  return (
    <DashboardShell>
      <DashboardHeader title="Gestion des événements" description="Crée et publie les événements visibles dans la partie Événements & Jeux du site." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">L’événement a été enregistré.</div>}
      {params.deleted && <div className="dashboard-feedback">L’événement a été supprimé.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Vérifie le titre, la date et le statut.</div>}

      <article className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">＋</span><div><h2>Créer un événement</h2><p>Le statut « Publié » l’affiche immédiatement aux membres.</p></div></div>
        <form action={saveEvent} className="backoffice-form backoffice-form-wide">
          <label>Titre<input name="title" required placeholder="Exemple : Grand Prix Nostra" /></label>
          <label>Lieu<input name="location" placeholder="Nostra Circuit" /></label>
          <label>Statut<select name="status" defaultValue="draft"><option value="draft">Brouillon</option><option value="published">Publié</option><option value="cancelled">Annulé</option><option value="completed">Terminé</option></select></label>
          <label>Début<input type="datetime-local" name="starts_at" required /></label>
          <label>Fin<input type="datetime-local" name="ends_at" /></label>
          <label className="checkbox-label"><input type="checkbox" name="registration_open" /> Inscriptions ouvertes</label>
          <label className="form-span-3">Description<textarea name="description" rows={4} /></label>
          <button className="btn" type="submit">Créer l’événement</button>
        </form>
      </article>

      <section className="event-admin-list">
        {events.length === 0 && <div className="backoffice-panel empty-state">Aucun événement enregistré.</div>}
        {events.map((event) => (
          <article className="backoffice-panel event-admin-card" key={event.id}>
            <div className="event-admin-head">
              <div><span className={`event-status event-status-${event.status}`}>{event.status}</span><h2>{event.title}</h2></div>
              <span>{new Date(event.starts_at).toLocaleString("fr-FR")}</span>
            </div>
            <form action={saveEvent} className="backoffice-form backoffice-form-wide">
              <input type="hidden" name="id" value={event.id} />
              <label>Titre<input name="title" defaultValue={event.title} required /></label>
              <label>Lieu<input name="location" defaultValue={event.location} /></label>
              <label>Statut<select name="status" defaultValue={event.status}><option value="draft">Brouillon</option><option value="published">Publié</option><option value="cancelled">Annulé</option><option value="completed">Terminé</option></select></label>
              <label>Début<input type="datetime-local" name="starts_at" defaultValue={localInput(event.starts_at)} required /></label>
              <label>Fin<input type="datetime-local" name="ends_at" defaultValue={localInput(event.ends_at)} /></label>
              <label className="checkbox-label"><input type="checkbox" name="registration_open" defaultChecked={event.registration_open} /> Inscriptions ouvertes</label>
              <label className="form-span-3">Description<textarea name="description" rows={4} defaultValue={event.description} /></label>
              <button className="btn" type="submit">Enregistrer les modifications</button>
            </form>
            <form action={deleteEvent} className="danger-form">
              <input type="hidden" name="id" value={event.id} />
              <button type="submit">Supprimer l’événement</button>
            </form>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
