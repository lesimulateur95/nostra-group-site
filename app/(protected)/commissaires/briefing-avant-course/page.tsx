export default function CommissionerBriefingPage() {
  return (
    <article className="circuit-document commissioner-document">
      <header className="document-hero">
        <p className="eyebrow">NOSTRA CIRCUIT · COMMISSAIRES</p>
        <h1 className="page-title">🚦 Briefing avant chaque course</h1>
        <p className="document-intro">Cette page sert de modèle pour préparer le planning de chaque événement. Un retard maximal de cinq minutes peut être toléré. Le planning peut être adapté, mais il doit rester cohérent et compréhensible pour toute l’équipe.</p>
      </header>

      <section className="document-section briefing-template-card">
        <h2>🏁 Planning de l’événement</h2>
        <dl className="briefing-planning-list">
          <div><dt>Ouverture des stands</dt><dd>20h00</dd></div>
          <div><dt>Qualifications</dt><dd>20h15</dd></div>
          <div><dt>Départ</dt><dd>20h30</dd></div>
          <div><dt>Voiture</dt><dd>À compléter</dd></div>
          <div><dt>Nombre de tours</dt><dd>À compléter</dd></div>
          <div><dt>Météo</dt><dd>À compléter</dd></div>
          <div><dt>Commissaires</dt><dd>À compléter</dd></div>
          <div><dt>Direction de course</dt><dd>À compléter</dd></div>
        </dl>
      </section>

      <section className="document-section">
        <h2>📻 Annonces radio à utiliser</h2>
        <ul className="document-list commissioner-signal-list">
          <li><strong>🟢 Ouverture des stands</strong><span>La piste et les stands sont accessibles.</span></li>
          <li><strong>🟡 Qualifications dans 10 minutes</strong><span>Prévenir les pilotes avant la fermeture des stands.</span></li>
          <li><strong>🔴 Départ reporté</strong><span>Informer immédiatement les pilotes et préciser le nouveau départ dès qu’il est connu.</span></li>
          <li><strong>🏁 Fin de course</strong><span>Annoncer la fin et organiser le retour sécurisé aux stands.</span></li>
        </ul>
      </section>

      <footer className="document-signature">
        <strong>NOSTRA CIRCUIT</strong>
        <p>Le briefing doit être préparé avant l’arrivée des pilotes et partagé avec tous les commissaires présents.</p>
      </footer>
    </article>
  );
}
