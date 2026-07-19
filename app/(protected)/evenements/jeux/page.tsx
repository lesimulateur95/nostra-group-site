import { EditablePage } from "@/components/site/editable-page";

export default function JeuxPage() {
  const fallback = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">ÉVÉNEMENTS & JEUX</p>
        <h1 className="page-title">Bingo & Tombola</h1>
        <p className="lead">Les modalités précises de chaque partie ou tirage sont publiées au moment de l’annonce.</p>
      </header>
      <section className="games-duo-grid">
        <article className="document-section"><h2>🎱 Bingo</h2><p>Les citoyens participent avec un ou plusieurs cartons selon les règles annoncées. Les numéros sont tirés et annoncés jusqu’à ce qu’un participant atteigne l’objectif de la partie. Le carton gagnant est contrôlé avant validation du lot.</p></article>
        <article className="document-section"><h2>🎟️ Tombola</h2><p>Les citoyens achètent des tickets numérotés pendant la période d’ouverture. À la clôture, un ticket est tiré au sort. Le lot, le tarif, la date du tirage et le résultat sont annoncés officiellement par Nostra Group.</p></article>
      </section>
    </article>
  );
  return <EditablePage slug="evenements-jeux" eyebrow="Événements & Jeux" defaultTitle="Bingo & Tombola">{fallback}</EditablePage>;
}
