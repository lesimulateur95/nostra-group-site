import { EditablePage } from "@/components/site/editable-page";

export default function JeuxPage() {
  const fallback = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">ÉVÉNEMENTS & JEUX</p>
        <h1 className="page-title">Bingo</h1>
        <p className="lead">Les modalités précises de chaque partie sont publiées au moment de l’annonce officielle.</p>
      </header>
      <section className="document-section">
        <h2>🎱 Fonctionnement du Bingo</h2>
        <p>Les citoyens participent avec un ou plusieurs cartons selon les règles annoncées. Les numéros sont tirés et annoncés progressivement jusqu’à ce qu’un participant atteigne l’objectif prévu pour la partie.</p>
        <p>Le carton gagnant est contrôlé avant la validation du lot. La date, l’horaire, le prix des cartons, le nombre maximal de cartons et la récompense sont communiqués dans l’annonce du Bingo.</p>
      </section>
    </article>
  );
  return <EditablePage slug="evenements-jeux" eyebrow="Événements & Jeux" defaultTitle="Bingo">{fallback}</EditablePage>;
}
