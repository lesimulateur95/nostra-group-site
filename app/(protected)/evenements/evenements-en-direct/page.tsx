import { LiveEventPublic } from "@/components/live-events/live-event-public";
import { getPublicLiveEventBoards } from "@/lib/live-events/data";

export default async function PublicLiveEventsPage() {
  const events = await getPublicLiveEventBoards();
  return (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">ÉVÉNEMENTS & JEUX</p>
        <h1 className="page-title">Événements en direct</h1>
        <p className="lead">Suivez les participants, qualifications, scores et résultats mis à jour en direct par l’équipe Nostra Group.</p>
      </header>
      <section className="document-section">
        <LiveEventPublic initialEvents={events} />
      </section>
    </article>
  );
}
