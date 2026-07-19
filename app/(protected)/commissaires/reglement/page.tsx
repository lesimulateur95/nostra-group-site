export default function CommissionersRulesPage() {
  return (
    <article className="circuit-document commissioner-document">
      <header className="document-hero">
        <p className="eyebrow">NOSTRA CIRCUIT · ACCÈS RÉSERVÉ</p>
        <h1 className="page-title">🏁 Règlement des commissaires de piste</h1>
        <p className="document-intro">Les commissaires de piste sont les représentants officiels du Nostra Circuit. Ils assurent la sécurité des pilotes, le bon déroulement des sessions et le respect du règlement.</p>
      </header>

      <section className="document-section">
        <h2>🚦 Article 1 — Missions</h2>
        <p>Les commissaires sont chargés de :</p>
        <ul className="document-list">
          <li>Ouvrir et fermer le circuit.</li>
          <li>Donner le départ des sessions.</li>
          <li>Utiliser les panneaux de signalisation.</li>
          <li>Surveiller le bon déroulement des sessions.</li>
          <li>Signaler les incidents.</li>
          <li>Appliquer le règlement du circuit.</li>
          <li>Assister les pilotes en cas de problème.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>👷 Article 2 — Tenue obligatoire</h2>
        <p>Pendant leur service, les commissaires doivent obligatoirement porter :</p>
        <ul className="document-list value-list">
          <li>✅ Tenue officielle du Nostra Circuit.</li>
          <li>✅ Casque de sécurité.</li>
          <li>✅ Gilet haute visibilité, si nécessaire.</li>
          <li>✅ Équipement radio fonctionnel.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>📣 Article 3 — Comportement</h2>
        <p>Les commissaires doivent être impartiaux, rester courtois, donner des consignes claires, garder leur calme en toutes circonstances et montrer l’exemple.</p>
        <p className="rule-forbidden">Il est interdit de favoriser une équipe ou un pilote.</p>
      </section>

      <section className="document-section">
        <h2>🚩 Article 4 — Gestion des signaux</h2>
        <p>Les commissaires sont responsables de l’utilisation des panneaux de signalisation.</p>
        <ul className="document-list commissioner-signal-list">
          <li><strong>🟢 Vert</strong><span>Ouverture de la piste ou début de session.</span></li>
          <li><strong>🟡 Jaune</strong><span>Danger sur le circuit : les pilotes doivent ralentir.</span></li>
          <li><strong>🔴 Rouge</strong><span>Session interrompue : retour immédiat aux stands.</span></li>
          <li><strong>🔵 Bleu</strong><span>Fin de session : les pilotes terminent leur tour et regagnent les stands.</span></li>
        </ul>
        <p>Les panneaux doivent être utilisés uniquement lorsque la situation l’exige.</p>
      </section>

      <section className="document-section">
        <h2>🛑 Article 5 — Incidents</h2>
        <p>En cas d’accident ou d’incident :</p>
        <ul className="document-list">
          <li>Sécuriser la zone.</li>
          <li>Informer immédiatement les autres commissaires.</li>
          <li>Suspendre la session si nécessaire.</li>
          <li>Rédiger un compte rendu après l’intervention.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>📞 Article 6 — Communication</h2>
        <p>Les commissaires doivent rester joignables par radio durant toute la durée de leur service. Toute information importante doit être transmise rapidement au responsable du circuit.</p>
      </section>

      <section className="document-section">
        <h2>⚠️ Article 7 — Sanctions</h2>
        <p>Un commissaire peut être sanctionné en cas de :</p>
        <ul className="document-list forbidden-list">
          <li>❌ Abandon de poste.</li>
          <li>❌ Utilisation abusive des panneaux.</li>
          <li>❌ Manque de respect.</li>
          <li>❌ Favoritisme.</li>
          <li>❌ Non-respect du règlement.</li>
          <li>❌ Mise en danger des participants.</li>
        </ul>
        <p>Les sanctions peuvent aller du simple avertissement jusqu’au retrait définitif de la fonction de commissaire.</p>
      </section>

      <section className="document-section">
        <h2>🤝 Article 8 — Devoir de confidentialité</h2>
        <p>Les commissaires s’engagent à ne pas divulguer les informations internes du Nostra Circuit concernant :</p>
        <ul className="document-list">
          <li>Les décisions de l’équipe.</li>
          <li>Les incidents en cours de traitement.</li>
          <li>Les informations confidentielles des pilotes ou des équipes.</li>
        </ul>
      </section>

      <footer className="document-signature">
        <strong>🏁 NOSTRA CIRCUIT</strong>
        <p>Être commissaire est une responsabilité. Votre rôle est essentiel pour garantir la sécurité, le bon déroulement des événements et l’image professionnelle du Nostra Circuit.</p>
        <blockquote>Toute prise de fonction vaut acceptation du présent règlement.</blockquote>
      </footer>
    </article>
  );
}
