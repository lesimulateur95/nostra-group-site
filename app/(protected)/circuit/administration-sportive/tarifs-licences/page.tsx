import { EditablePage } from "@/components/site/editable-page";

export default function TarifsLicencesPage() {
  const defaultContent = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">Nostra Circuit</p>
        <h1 className="page-title">Tarifs des licences pilotes</h1>
      </header>

      <section className="licence-price-card">
        <span>🟢 Licence C</span>
        <strong>300.000 €</strong>
      </section>

      <section className="document-section">
        <h2>📌 Informations</h2>
        <ul className="document-list">
          <li>Le certificat médical est obligatoire pour toute demande de licence.</li>
          <li>Le paiement est effectué lors de la délivrance de la licence.</li>
          <li>Une licence suspendue ou retirée n’est pas remboursée.</li>
          <li>La licence est personnelle et ne peut être cédée à un tiers.</li>
        </ul>
      </section>

      <footer className="document-signature"><strong>🏁 NOSTRA CIRCUIT</strong></footer>
    </article>
  );

  return (
    <EditablePage slug="licence-tarifs" defaultTitle="Tarifs des licences pilotes">
      {defaultContent}
    </EditablePage>
  );
}
