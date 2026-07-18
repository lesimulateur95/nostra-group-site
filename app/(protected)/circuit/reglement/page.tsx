import { EditablePage } from "@/components/site/editable-page";

function RuleSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return <section className="document-section" id={id}><h2>{title}</h2>{children}</section>;
}

export default function ReglementPage() {
  const defaultContent = (
    <article className="circuit-document regulation-document">
      <header className="document-hero">
        <p className="eyebrow">Nostra Circuit</p>
        <h1 className="page-title">Règlement du Nostra Circuit</h1>
        <p className="document-warning">
          Toute personne entrant sur le site du Nostra Circuit accepte le présent règlement. Le non-respect de celui-ci pourra entraîner une exclusion immédiate du circuit, sans remboursement.
        </p>
      </header>

      <RuleSection title="🚪 Article 1 — Accès au circuit">
        <ul className="document-list">
          <li>L’accès est réservé aux personnes autorisées.</li>
          <li>Toute session doit être réservée et validée par les membres du circuit.</li>
          <li>Les visiteurs doivent respecter les zones autorisées.</li>
          <li>Le personnel du circuit est habilité à contrôler les accès à tout moment.</li>
        </ul>
      </RuleSection>

      <RuleSection title="🪖 Article 2 — Équipements obligatoires">
        <p>Pour accéder à la piste, chaque pilote doit être équipé de :</p>
        <ul className="document-list value-list">
          <li>✅ Casque homologué obligatoire.</li>
          <li>✅ Tenue de conduite adaptée.</li>
          <li>✅ Chaussures fermées.</li>
          <li>✅ Gants de conduite fortement recommandés.</li>
        </ul>
        <p>Le personnel peut refuser l’accès à toute personne ne présentant pas un équipement jugé suffisant.</p>
      </RuleSection>

      <RuleSection title="🚭 Article 3 — Sécurité">
        <p>Il est strictement interdit :</p>
        <ul className="document-list forbidden-list">
          <li>❌ De fumer sur la piste.</li>
          <li>❌ De vapoter dans les stands.</li>
          <li>❌ D’utiliser des produits inflammables sans autorisation.</li>
          <li>❌ De consommer de l’alcool ou des stupéfiants avant ou pendant une session.</li>
          <li>❌ D’entrer sur la piste à pied.</li>
        </ul>
      </RuleSection>

      <RuleSection title="🏎 Article 4 — Comportement en piste">
        <p>Il est interdit de :</p>
        <ul className="document-list forbidden-list">
          <li>❌ Rouler à contre-sens.</li>
          <li>❌ Bloquer volontairement un concurrent.</li>
          <li>❌ Percuter volontairement un autre véhicule.</li>
          <li>❌ Faire demi-tour sur le circuit.</li>
          <li>❌ Stationner sur la piste.</li>
          <li>❌ Sortir volontairement des limites du circuit.</li>
          <li>❌ Effectuer des burnouts ou donuts hors des zones prévues.</li>
        </ul>
        <p>Tout comportement dangereux pourra entraîner une exclusion immédiate.</p>
      </RuleSection>

      <RuleSection title="🏁 Article 5 — Stands">
        <p>Chaque équipe dispose d’un stand attribué.</p>
        <p>Il est interdit :</p>
        <ul className="document-list forbidden-list">
          <li>❌ D’utiliser le stand d’une autre équipe.</li>
          <li>❌ De déplacer le matériel appartenant à une autre équipe.</li>
          <li>❌ D’encombrer les voies des stands.</li>
          <li>❌ De laisser des déchets.</li>
        </ul>
        <p>Les stands doivent rester propres pendant toute la durée de l’événement.</p>
      </RuleSection>

      <RuleSection title="🚦 Article 6 — Limitation de vitesse">
        <p>Dans les stands :</p>
        <p className="rule-highlight">🚧 Vitesse limitée à 30 km/h.</p>
        <p>Tout excès pourra entraîner une pénalité.</p>
      </RuleSection>

      <RuleSection title="🚩 Article 7 — Signalisation du circuit">
        <ul className="document-list signal-list">
          <li><strong>🟢 Vert :</strong> La piste est libre. La session est officiellement lancée ou reprend après une interruption.</li>
          <li><strong>🟡 Danger sur la piste :</strong> Les pilotes doivent ralentir immédiatement, rester vigilants et il est interdit de dépasser jusqu’à la levée du drapeau jaune.</li>
          <li><strong>🔴 Rouge :</strong> Arrêt immédiat de la session.</li>
          <li><strong>🔵 Drapeau bleu — Fin de la session :</strong> Les pilotes terminent leur tour en cours, ralentissent progressivement et regagnent les stands dans le calme.</li>
        </ul>
      </RuleSection>

      <RuleSection title="👥 Article 8 — Respect">
        <p>Tous les participants doivent respecter :</p>
        <ul className="document-list">
          <li>les commissaires ;</li>
          <li>les organisateurs ;</li>
          <li>les autres pilotes ;</li>
          <li>les spectateurs.</li>
        </ul>
        <p>Les insultes, provocations ou comportements toxiques sont interdits.</p>
      </RuleSection>

      <RuleSection title="🔧 Article 9 — Véhicules">
        <p>Les véhicules doivent être en bon état.</p>
        <p>Le staff peut refuser un véhicule présentant un danger pour les autres participants.</p>
        <p>Toute fuite importante ou tout dommage majeur peut entraîner un refus d’accès.</p>
      </RuleSection>

      <RuleSection title="📸 Article 10 — Médias">
        <p>Les photos et vidéos sont autorisées.</p>
        <p>Toute utilisation visant à nuire un participant pourra être sanctionnée.</p>
      </RuleSection>

      <RuleSection title="🏆 Article 11 — Records">
        <p>Les records sont uniquement validés :</p>
        <ul className="document-list">
          <li>pendant une session officielle ;</li>
          <li>avec un véhicule autorisé ;</li>
          <li>sans assistance extérieure ;</li>
          <li>après validation du staff.</li>
        </ul>
      </RuleSection>

      <RuleSection title="⚠ Article 12 — Sanctions">
        <p>Le personnel du Nostra Circuit peut appliquer :</p>
        <ul className="document-list sanctions-list">
          <li>🟡 Avertissement</li>
          <li>🟠 Pénalité</li>
          <li>🔴 Exclusion de la session</li>
          <li>⛔ Suspension temporaire</li>
          <li>🚫 Bannissement définitif du circuit</li>
        </ul>
        <p>Les décisions de l’équipe sont sans appel.</p>
      </RuleSection>

      <header className="document-hero document-hero-secondary" id="reglement-piste">
        <p className="eyebrow">Nostra Circuit</p>
        <h2 className="document-main-heading">🏁 Règlement en piste</h2>
        <p className="document-intro">Le présent règlement s’applique à tous les pilotes participant à un événement officiel organisé par le Nostra Circuit.</p>
        <p className="document-warning">Le non-respect de ces règles pourra entraîner une pénalité, une disqualification ou une suspension.</p>
      </header>

      <RuleSection title="📋 Avant la course">
        <p>Tous les pilotes devront se présenter au contrôle technique (Check-Up) avant le début de la session.</p>
        <p>Le contrôle comprend notamment :</p>
        <ul className="document-list value-list">
          <li>✅ Vérification de l’identité du pilote.</li>
          <li>✅ Vérification de la licence.</li>
          <li>✅ Vérification du véhicule attribué.</li>
          <li>✅ Briefing obligatoire.</li>
        </ul>
        <p>Tout pilote absent au contrôle technique pourra être refusé au départ.</p>
      </RuleSection>

      <RuleSection title="🏎️ Mise en grille">
        <p>Une fois le contrôle terminé :</p>
        <ul className="document-list">
          <li>Chaque pilote rejoint sa position sur la grille de départ.</li>
          <li>Le placement devra respecter l’ordre communiqué par la Direction de Course.</li>
          <li>Il est interdit de changer de position sans autorisation.</li>
        </ul>
      </RuleSection>

      <RuleSection title="🚨 Tour de reconnaissance">
        <p>Le tour de reconnaissance est effectué derrière la Safety Car.</p>
        <p>Durant ce tour :</p>
        <ul className="document-list forbidden-list">
          <li>❌ Aucun dépassement n’est autorisé.</li>
          <li>❌ Aucun départ d’essai.</li>
          <li>❌ Aucun comportement dangereux.</li>
        </ul>
        <p>Les pilotes doivent conserver leur position jusqu’au retour de la Safety Car.</p>
      </RuleSection>

      <RuleSection title="🟢 Départ de la course">
        <p>Lorsque la Safety Car quitte la piste :</p>
        <p className="rule-forbidden">❌ Les dépassements restent interdits.</p>
        <p>Le départ officiel est donné uniquement lorsque :</p>
        <ul className="document-list value-list">
          <li>✅ Le pilote en tête accélère.</li>
          <li>OU</li>
          <li>✅ Le pilote de tête franchit la ligne de départ.</li>
        </ul>
        <p>À partir de cet instant, la course est officiellement lancée et les dépassements sont autorisés.</p>
      </RuleSection>

      <RuleSection title="🏁 Pendant la course">
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
      </RuleSection>

      <RuleSection title="🔧 Arrêt aux stands">
        <p>Chaque pilote devra effectuer :</p>
        <p className="rule-highlight">🛠️ Un arrêt obligatoire aux stands durant la course.</p>
        <p>Le non-respect de cette obligation entraînera une pénalité décidée par la Direction de Course.</p>
      </RuleSection>

      <RuleSection title="🏁 Dernier tour">
        <p>Lorsque le leader entame le dernier tour :</p>
        <ul className="document-list">
          <li>📢 Une annonce radio sera diffusée.</li>
          <li>🚦 La signalisation du circuit indiquera également le dernier tour.</li>
        </ul>
        <p>Chaque pilote termine son tour normalement jusqu’au passage sous le drapeau à damier.</p>
      </RuleSection>

      <RuleSection title="🧊 Tour de refroidissement">
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
      </RuleSection>

      <RuleSection title="🏁 Retour aux stands">
        <p>À la fin du tour de refroidissement :</p>
        <p>Chaque pilote rejoint les stands.</p>
        <p>Les véhicules devront être stationnés dans l’ordre d’arrivée de la course.</p>
        <p>Les pilotes devront respecter les emplacements indiqués par la Direction de Course.</p>
      </RuleSection>

      <RuleSection title="🚫 Fin de course">
        <p>Une fois immobilisés :</p>
        <p className="rule-forbidden">❌ Il est interdit de quitter son véhicule tant que tous les concurrents ne sont pas revenus aux stands et complètement arrêtés.</p>
        <p>Les pilotes attendront l’autorisation de la Direction de Course avant de descendre de leur véhicule.</p>
      </RuleSection>

      <footer className="document-signature">
        <p>🏁 Le respect de ce règlement garantit la sécurité, l’équité et le bon déroulement de chaque compétition organisée par le Nostra Circuit.</p>
      </footer>
    </article>
  );

  return (
    <EditablePage slug="circuit-reglement" defaultTitle="Règlement du Nostra Circuit">
      {defaultContent}
    </EditablePage>
  );
}
