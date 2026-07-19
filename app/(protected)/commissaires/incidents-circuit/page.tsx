export default function CommissionerIncidentsPage() {
  return (
    <article className="circuit-document commissioner-document">
      <header className="document-hero">
        <p className="eyebrow">NOSTRA CIRCUIT · COMMISSAIRES</p>
        <h1 className="page-title">🚨 Incidents circuit</h1>
        <p className="document-intro">Cette rubrique est réservée au suivi des accidents, comportements dangereux et événements ayant nécessité une intervention des commissaires.</p>
      </header>

      <section className="document-section">
        <h2>📋 Informations à relever</h2>
        <ul className="document-list document-list-columns">
          <li>Date et heure de l’incident.</li>
          <li>Session ou championnat concerné.</li>
          <li>Nom des pilotes et équipes impliqués.</li>
          <li>Zone précise du circuit.</li>
          <li>Description factuelle de l’incident.</li>
          <li>Signalisation et intervention effectuées.</li>
          <li>Témoins ou commissaires présents.</li>
          <li>Décision de la Direction de Course.</li>
        </ul>
      </section>

      <section className="document-section empty-official-section">
        <h2>Aucun compte rendu publié</h2>
        <p>La gestion complète des rapports d’incident pourra être ajoutée dans une prochaine mise à jour avec un formulaire et un historique dans le Dashboard.</p>
      </section>
    </article>
  );
}
