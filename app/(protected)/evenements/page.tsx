import Link from "next/link";
import { getEvents } from "@/lib/backoffice/data";

export default async function EventsPage() {
  const events = await getEvents(false);
  const upcoming = events.slice(0, 3);

  return (
    <>
      <p className="eyebrow">Nostra Group</p>
      <h1 className="page-title">Événements & Jeux</h1>
      <p className="lead">Retrouvez ici les animations de Nostra Group : rassemblements, jeux communautaires, soirées spéciales et inscriptions.</p>

      <div className="content-grid">
        <article className="info-card"><h3>Événements automobiles</h3><p>Rassemblements, expositions et soirées circuit.</p></article>
        <article className="info-card"><h3>Jeux communautaires</h3><p>Bingo, tombolas et animations ponctuelles.</p></article>
        <article className="info-card"><h3>Inscriptions centralisées</h3><p>Une seule interface pour suivre les participations.</p></article>
      </div>

      <section className="public-events-section">
        <div className="public-section-head"><div><p className="eyebrow">PROCHAINEMENT</p><h2>Événements publiés</h2></div><Link href="/evenements/agenda">Voir tout l’agenda →</Link></div>
        <div className="public-event-grid">
          {upcoming.length === 0 && <article className="info-card empty-state">Aucun événement publié pour le moment.</article>}
          {upcoming.map((event) => (
            <article className="public-event-card" key={event.id}>
              <span className="event-date-chip">{new Date(event.starts_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
              <div><h3>{event.title}</h3><p>{event.description || "Informations à venir."}</p></div>
              <footer><span>{new Date(event.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span><span>{event.location || "Lieu à confirmer"}</span></footer>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
