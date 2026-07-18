export default function EventsPage() {
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
    </>
  );
}
