export default function ClassementPage() {
  return (
    <>
      <p className="eyebrow">Résultats officiels</p>
      <h1 className="page-title">Classements</h1>
      <p className="lead">
        Retrouvez les classements officiels mis à jour après validation des résultats.
      </p>
      <div className="content-grid">
        <article className="info-card"><h3>Classement F1</h3><p>Classement général des pilotes du championnat F1.</p></article>
        <article className="info-card"><h3>Classement des écuries</h3><p>Classement général des écuries du championnat F1.</p></article>
        <article className="info-card"><h3>Classement GT3 RS</h3><p>Classement général du championnat GT3 RS.</p></article>
      </div>
    </>
  );
}
