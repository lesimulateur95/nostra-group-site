import { EditablePage } from "@/components/site/editable-page";

export default function ChampionnatF1Page() {
  const defaultContent = (
    <>
      <p className="eyebrow">Compétition</p>
      <h1 className="page-title">Championnat F1</h1>
      <p className="lead">Espace officiel du championnat F1 organisé sur le Nostra Circuit.</p>
      <div className="content-grid">
        <article className="info-card" id="calendrier"><h3>Calendrier</h3><p>Dates et horaires des épreuves du championnat.</p></article>
        <article className="info-card" id="participants"><h3>Pilotes & écuries</h3><p>Liste officielle des participants engagés.</p></article>
        <article className="info-card" id="resultats"><h3>Résultats</h3><p>Résultats publiés après validation officielle.</p></article>
      </div>
    </>
  );
  return <EditablePage slug="championnat-f1" defaultTitle="Championnat F1" eyebrow="Compétition">{defaultContent}</EditablePage>;
}
