import { EditablePage } from "@/components/site/editable-page";

export default function ChampionnatGt3RsPage() {
  const defaultContent = (
    <>
      <p className="eyebrow">Compétition</p>
      <h1 className="page-title">Championnat Porsche GT3 RS</h1>
      <p className="lead">Espace officiel du championnat Porsche GT3 RS organisé sur le Nostra Circuit.</p>
      <div className="content-grid">
        <article className="info-card" id="calendrier"><h3>Calendrier</h3><p>Dates et horaires des épreuves du championnat.</p></article>
        <article className="info-card" id="participants"><h3>Pilotes</h3><p>Liste officielle des participants engagés.</p></article>
        <article className="info-card" id="resultats"><h3>Résultats</h3><p>Résultats publiés après validation officielle.</p></article>
      </div>
    </>
  );
  return <EditablePage slug="championnat-gt3rs" defaultTitle="Championnat Porsche GT3 RS" eyebrow="Compétition">{defaultContent}</EditablePage>;
}
