import { EditablePage } from "@/components/site/editable-page";

export default function ReglementLicencesPage() {
  const defaultContent = (
    <article className="circuit-document regulation-document">
      <header className="document-hero">
        <p className="eyebrow">Nostra Circuit</p>
        <h1 className="page-title">Règlement des licences pilotes</h1>
        <p className="document-intro">
          Toute personne souhaitant participer aux activités officielles du Nostra Circuit — championnats, événements, essais officiels, etc. — doit être titulaire d’une licence pilote valide.
        </p>
      </header>

      <section className="document-section">
        <h2>📄 Article 1 — Conditions d’obtention</h2>
        <p>Pour obtenir une licence pilote, le candidat doit :</p>
        <ul className="document-list value-list">
          <li>✅ Être en possession d’un certificat médical valide.</li>
          <li>✅ Ne présenter aucun trouble de la vision pouvant compromettre la sécurité sur la piste.</li>
          <li>✅ Avoir pris connaissance du règlement du Nostra Circuit.</li>
          <li>✅ Respecter l’ensemble des consignes données par les commissaires de piste et le personnel.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>🏥 Article 2 — Certificat médical</h2>
        <p>Le certificat médical est obligatoire pour toute première demande de licence.</p>
        <p>Il doit attester que le pilote :</p>
        <ul className="document-list">
          <li>est apte à la pratique du sport automobile ;</li>
          <li>ne présente aucune contre-indication médicale connue ;</li>
          <li>dispose d’une vision compatible avec la conduite sur circuit.</li>
        </ul>
        <p>Le personnel du Nostra Circuit peut demander un nouveau certificat en cas de doute ou de renouvellement de licence.</p>
      </section>

      <section className="document-section">
        <h2>👁️ Article 3 — Vision</h2>
        <p>Les pilotes doivent disposer d’une vision leur permettant de conduire en toute sécurité.</p>
        <p>Les troubles visuels non corrigés pouvant mettre en danger les autres participants peuvent entraîner un refus de délivrance de la licence.</p>
      </section>

      <section className="document-section">
        <h2>🚗 Article 4 — Comportement</h2>
        <p>La licence peut être suspendue ou retirée en cas de :</p>
        <ul className="document-list forbidden-list">
          <li>❌ Comportement dangereux.</li>
          <li>❌ Non-respect du règlement.</li>
          <li>❌ Percussions volontaires.</li>
          <li>❌ Conduite agressive ou anti-jeu.</li>
          <li>❌ Refus d’obéir aux commissaires.</li>
          <li>❌ Mise en danger des autres pilotes.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>🏁 Article 5 — Validité</h2>
        <p>La licence est valable pour la saison.</p>
        <p>Le personnel se réserve le droit de suspendre ou retirer une licence à tout moment.</p>
      </section>

      <section className="document-section">
        <h2>📋 Article 6 — Obligations du pilote</h2>
        <p>Chaque pilote s’engage à :</p>
        <ul className="document-list">
          <li>Respecter les installations.</li>
          <li>Respecter les autres pilotes.</li>
          <li>Respecter les commissaires.</li>
          <li>Porter les équipements de sécurité obligatoires.</li>
          <li>Signaler tout problème mécanique avant de prendre la piste.</li>
        </ul>
      </section>

      <section className="document-section">
        <h2>⛔ Article 7 — Sanctions</h2>
        <p>En cas de manquement, les sanctions suivantes pourront être appliquées :</p>
        <ul className="document-list sanctions-list">
          <li>🟡 Avertissement.</li>
          <li>🟠 Suspension temporaire de la licence.</li>
          <li>🔴 Retrait définitif de la licence.</li>
          <li>🚫 Interdiction de participer aux activités organisées par le Nostra Circuit.</li>
        </ul>
      </section>

      <footer className="document-signature">
        <p>🏁 La délivrance d’une licence pilote constitue un engagement à respecter les valeurs du Nostra Circuit : sécurité, fair-play et respect.</p>
        <p>Toute demande de licence vaut acceptation pleine et entière du présent règlement.</p>
        <strong>🏁 NOSTRA CIRCUIT</strong>
      </footer>
    </article>
  );

  return (
    <EditablePage slug="licence-reglement" defaultTitle="Règlement des licences pilotes">
      {defaultContent}
    </EditablePage>
  );
}
