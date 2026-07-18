import { EditablePage } from "@/components/site/editable-page";

export default function JournalOfficielPage() {
  const defaultContent = (
    <>
      <p className="eyebrow">Publications officielles</p>
      <h1 className="page-title">Journal officiel</h1>
      <p className="lead">Les annonces, décisions et résultats officiels du Nostra Circuit seront publiés dans cette rubrique.</p>
      <div className="content-grid">
        <article className="info-card" id="communiques"><h3>Communiqués</h3><p>Annonces officielles du circuit.</p></article>
        <article className="info-card" id="decisions"><h3>Décisions</h3><p>Décisions sportives et administratives publiées.</p></article>
        <article className="info-card" id="resultats"><h3>Résultats homologués</h3><p>Résultats validés après chaque épreuve.</p></article>
      </div>
    </>
  );

  return <EditablePage slug="journal-officiel" defaultTitle="Journal officiel" eyebrow="Publications officielles">{defaultContent}</EditablePage>;
}
