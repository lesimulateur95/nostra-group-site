export default function ReservationsPage() {
  return (
    <>
      <p className="eyebrow">Accès au circuit</p>
      <h1 className="page-title">Réservations</h1>
      <p className="lead">
        Cette rubrique centralise les demandes de réservation et les créneaux validés du Nostra Circuit.
      </p>
      <div className="content-grid">
        <article className="info-card"><h3>Demande de créneau</h3><p>Déposer une demande de réservation du circuit.</p></article>
        <article className="info-card"><h3>Réservations validées</h3><p>Consulter les créneaux officiellement confirmés.</p></article>
        <article className="info-card"><h3>Conditions d’accès</h3><p>Informations nécessaires avant toute réservation.</p></article>
      </div>
    </>
  );
}
