import { deleteEvent, saveEvent } from "@/app/actions/backoffice";
import { DashboardChampionshipPlanner } from "@/components/calendar/dashboard-championship-planner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getChampionshipEvents } from "@/lib/backoffice/data";

function localInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export default async function ChampionshipDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [f1Events, gt3Events] = await Promise.all([getChampionshipEvents("f1", true), getChampionshipEvents("gt3rs", true)]);

  return (
    <DashboardShell>
      <DashboardHeader title="Calendriers des championnats" description="Ajoute les manches F1 et GT3 RS directement dans leurs calendriers respectifs." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">L’événement a été publié dans le calendrier.</div>}
      {params.deleted && <div className="dashboard-feedback">L’événement a été supprimé.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Vérifie le titre, la date et l’horaire.</div>}

      <section className="championship-planner-grid">
        <DashboardChampionshipPlanner championship="f1" label="Championnat F1" />
        <DashboardChampionshipPlanner championship="gt3rs" label="Championnat GT3 RS" />
      </section>

      <section className="championship-event-admin">
        <EventGroup title="Événements F1" championship="f1" events={f1Events} />
        <EventGroup title="Événements GT3 RS" championship="gt3rs" events={gt3Events} />
      </section>
    </DashboardShell>
  );
}

function EventGroup({ title, championship, events }: { title: string; championship: "f1" | "gt3rs"; events: Awaited<ReturnType<typeof getChampionshipEvents>> }) {
  return (
    <section>
      <div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">CALENDRIER PUBLIÉ</p><h2>{title}</h2></div>
      <div className="event-admin-list">
        {events.length === 0 && <div className="backoffice-panel empty-state">Aucun événement enregistré.</div>}
        {events.map((event) => (
          <article className="backoffice-panel event-admin-card" key={event.id}>
            <div className="event-admin-head"><div><span className={`event-status event-status-${event.status}`}>{event.status}</span><h2>{event.title}</h2></div><span>{new Date(event.starts_at).toLocaleString("fr-FR")}</span></div>
            <form action={saveEvent} className="backoffice-form backoffice-form-wide">
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="championship" value={championship} />
              <input type="hidden" name="dashboard_target" value="championnats" />
              <label>Titre<input name="title" defaultValue={event.title} required /></label>
              <label>Lieu<input name="location" defaultValue={event.location} /></label>
              <label>Statut<select name="status" defaultValue={event.status}><option value="draft">Brouillon</option><option value="published">Publié</option><option value="cancelled">Annulé</option><option value="completed">Terminé</option></select></label>
              <label>Début<input type="datetime-local" name="starts_at" defaultValue={localInput(event.starts_at)} required /></label>
              <label>Fin<input type="datetime-local" name="ends_at" defaultValue={localInput(event.ends_at)} /></label>
              <label className="checkbox-label"><input type="checkbox" name="registration_open" defaultChecked={event.registration_open} /> Inscriptions ouvertes</label>
              <label className="form-span-3">Description<textarea name="description" rows={4} defaultValue={event.description} /></label>
              <button className="btn" type="submit">Enregistrer</button>
            </form>
            <form action={deleteEvent} className="danger-form"><input type="hidden" name="id" value={event.id} /><input type="hidden" name="dashboard_target" value="championnats" /><button type="submit">Supprimer</button></form>
          </article>
        ))}
      </div>
    </section>
  );
}
