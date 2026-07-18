import { getEvents } from "@/lib/backoffice/data";

export default async function AgendaPage() {
  const events = await getEvents(false);
  return (
    <>
      <p className="eyebrow">Programmation</p>
      <h1 className="page-title">Agenda</h1>
      <p className="lead">Les événements publiés depuis le Dashboard Gérant apparaissent automatiquement ici.</p>
      <section className="agenda-list">
        {events.length === 0 && <article className="info-card empty-state">Aucun événement publié pour le moment.</article>}
        {events.map((event) => (
          <article className="agenda-event" key={event.id}>
            <div className="agenda-date"><strong>{new Date(event.starts_at).toLocaleDateString("fr-FR", { day: "2-digit" })}</strong><span>{new Date(event.starts_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}</span></div>
            <div><span className={`event-status event-status-${event.status}`}>{event.registration_open ? "Inscriptions ouvertes" : "Information"}</span><h2>{event.title}</h2><p>{event.description}</p><footer>{new Date(event.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {event.location || "Lieu à confirmer"}</footer></div>
          </article>
        ))}
      </section>
    </>
  );
}
