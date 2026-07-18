export default function JournalOfficielPage() {
  return (
    <>
      <p className="eyebrow">Publications officielles</p>
      <h1 className="page-title">Journal officiel</h1>
      <p className="lead">
        Les annonces, décisions et résultats officiels du Nostra Circuit seront publiés dans cette rubrique.
      </p>
      <div className="content-grid">
        <article className="info-card"><h3>Communiqués</h3><p>Annonces officielles du circuit.</p></article>
        <article className="info-card"><h3>Décisions</h3><p>Décisions sportives et administratives publiées.</p></article>
        <article className="info-card"><h3>Résultats homologués</h3><p>Résultats validés après chaque épreuve.</p></article>
      </div>
    </>
  );
}
