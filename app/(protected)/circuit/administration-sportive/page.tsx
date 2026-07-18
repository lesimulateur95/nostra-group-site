export default function AdministrationSportivePage() {
  return (
    <>
      <p className="eyebrow">Nostra Circuit</p>
      <h1 className="page-title">Administration sportive</h1>
      <p className="lead">
        Espace consacré à l’organisation sportive du circuit et aux informations émises par sa direction.
      </p>
      <div className="content-grid">
        <article className="info-card"><h3>Direction sportive</h3><p>Organisation et encadrement officiel des compétitions.</p></article>
        <article className="info-card"><h3>Commissaires</h3><p>Informations destinées aux commissaires et officiels de piste.</p></article>
        <article className="info-card"><h3>Décisions sportives</h3><p>Décisions validées par l’administration sportive.</p></article>
      </div>
    </>
  );
}
