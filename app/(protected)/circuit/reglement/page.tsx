export default function ReglementPage() {
  return (
    <article className="circuit-document regulation-document">
      <header className="document-hero">
        <p className="eyebrow">Nostra Circuit</p>
        <h1 className="page-title">Règlement en piste</h1>
        <p className="document-intro">
          Le présent règlement s’applique à tous les pilotes participant à un événement officiel organisé par le Nostra Circuit.
        </p>
        <p className="document-warning">
          Le non-respect de ces règles pourra entraîner une pénalité, une disqualification ou une suspension.
        </p>
      </header>

      <section className="document-section">
        <h2>📋 Avant la course</h2>
        <p>Tous les pilotes devront se présenter au contrôle technique (Check-Up) avant le début de la session.</p>
        <p>Le contrôle comprend notamment :</p>
        <ul className="document-list value-list">
          <li>✅ Vérification de l’identité du pilote.</li>
          <li>✅ Vérification de la licence.</li>
          <li>✅ Vérification du véhicule attribué.</li>
          <li>✅ Briefing obligatoire.</li>
        </ul>
        <p>Tout pilote absent au contrôle technique pourra être refusé au départ.</p>
      </section>

      <section className="document-section">
        <h2>🏎️ Mise en grille</h2>
        <p>Une fois le contrôle terminé :</p>
        <ul className="document-list">
          <li>Chaque pilote rejoint sa position sur la grille de départ.</li>
          <li>Le placement devra respecter l’ordre communiqué par la Direction de Course.</li>
          <li>Il est interdit de changer de position sans autorisation.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>🚨 Tour de reconnaissance</h2>
        <p>Le tour de reconnaissance est effectué derrière la Safety Car.</p>
        <p>Durant ce tour :</p>
        <ul className="document-list forbidden-list">
          <li>❌ Aucun dépassement n’est autorisé.</li>
          <li>❌ Aucun départ d’essai.</li>
          <li>❌ Aucun comportement dangereux.</li>
        </ul>
        <p>Les pilotes doivent conserver leur position jusqu’au retour de la Safety Car.</p>
      </section>

      <section className="document-section">
        <h2>🟢 Départ de la course</h2>
        <p>Lorsque la Safety Car quitte la piste :</p>
        <p className="rule-forbidden">❌ Les dépassements restent interdits.</p>
        <p>Le départ officiel est donné uniquement lorsque :</p>
        <ul className="document-list value-list">
          <li>✅ Le pilote en tête accélère.</li>
          <li>OU</li>
          <li>✅ Le pilote de tête franchit la ligne de départ.</li>
        </ul>
        <p>À partir de cet instant, la course est officiellement lancée et les dépassements sont autorisés.</p>
      </section>

      <section className="document-section">
        <h2>🏁 Pendant la course</h2>
        <p>Chaque pilote devra :</p>
        <ul className="document-list value-list">
          <li>✅ Respecter les autres concurrents.</li>
          <li>✅ Respecter la signalisation du circuit.</li>
          <li>✅ Respecter les décisions des commissaires.</li>
        </ul>
        <p>Il est strictement interdit de :</p>
        <ul className="document-list forbidden-list">
          <li>❌ Couper volontairement un virage.</li>
          <li>❌ Sortir volontairement des limites de la piste pour gagner un avantage.</li>
          <li>❌ Percuter volontairement un autre concurrent.</li>
          <li>❌ Effectuer une conduite dangereuse.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>🔧 Arrêt aux stands</h2>
        <p>Chaque pilote devra effectuer :</p>
        <p className="rule-highlight">🛠️ Un arrêt obligatoire aux stands durant la course.</p>
        <p>Le non-respect de cette obligation entraînera une pénalité décidée par la Direction de Course.</p>
      </section>

      <section className="document-section">
        <h2>🏁 Dernier tour</h2>
        <p>Lorsque le leader entame le dernier tour :</p>
        <ul className="document-list">
          <li>📢 Une annonce radio sera diffusée.</li>
          <li>🚦 La signalisation du circuit indiquera également le dernier tour.</li>
        </ul>
        <p>Chaque pilote termine son tour normalement jusqu’au passage sous le drapeau à damier.</p>
      </section>

      <section className="document-section">
        <h2>🧊 Tour de refroidissement</h2>
        <p>Après avoir franchi la ligne d’arrivée :</p>
        <p>Les pilotes effectuent obligatoirement un tour de décélération.</p>
        <p>Ce tour permet :</p>
        <ul className="document-list">
          <li>de ralentir progressivement le moteur ;</li>
          <li>de refroidir les freins ;</li>
          <li>de rejoindre les stands en toute sécurité.</li>
        </ul>
        <p>Durant ce tour :</p>
        <ul className="document-list forbidden-list">
          <li>❌ Les dépassements sont interdits.</li>
          <li>❌ Les comportements dangereux sont interdits.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>🏁 Retour aux stands</h2>
        <p>À la fin du tour de refroidissement :</p>
        <p>Chaque pilote rejoint les stands.</p>
        <p>Les véhicules devront être stationnés dans l’ordre d’arrivée de la course.</p>
        <p>Les pilotes devront respecter les emplacements indiqués par la Direction de Course.</p>
      </section>

      <section className="document-section">
        <h2>🚫 Fin de course</h2>
        <p>Une fois immobilisés :</p>
        <p className="rule-forbidden">
          ❌ Il est interdit de quitter son véhicule tant que tous les concurrents ne sont pas revenus aux stands et complètement arrêtés.
        </p>
        <p>Les pilotes attendront l’autorisation de la Direction de Course avant de descendre de leur véhicule.</p>
      </section>

      <footer className="document-signature">
        <p>
          🏁 Le respect de ce règlement garantit la sécurité, l’équité et le bon déroulement de chaque compétition organisée par le Nostra Circuit.
        </p>
      </footer>
    </article>
  );
}
