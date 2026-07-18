const activities = [
  "Sessions libres",
  "Essais privés",
  "Privatisation du circuit",
  "Championnat Formule 1",
  "Championnat Porsche GT3 RS",
  "Création d’écuries officielles",
  "Homologation des véhicules",
  "Délivrance de licences pilotes",
  "Événements automobiles",
  "Journées découvertes",
];

const values = [
  "La sécurité",
  "Le respect entre pilotes",
  "Le fair-play",
  "Le professionnalisme",
  "La passion de l’automobile",
];

const facilities = [
  { icon: "🏁", text: "Une piste dédiée à la compétition" },
  { icon: "🏎️", text: "Des stands réservés aux écuries" },
  { icon: "👥", text: "Une zone d’accueil" },
  { icon: "📋", text: "Une direction de course" },
  { icon: "🏆", text: "Un système de championnat officiel" },
];

export default function CircuitPage() {
  return (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">Présentation officielle</p>
        <h1 className="page-title">Nostra Circuit</h1>
        <p className="document-intro">
          Bienvenue au <strong>NOSTRA CIRCUIT</strong>, un complexe automobile dédié à la passion de la conduite,
          de la compétition et du sport automobile.
        </p>
        <p className="document-intro">
          Notre objectif est de proposer un environnement professionnel où chaque pilote, qu’il soit débutant
          ou expérimenté, pourra évoluer dans des conditions optimales.
        </p>
      </header>

      <section className="document-section">
        <h2>🏎️ Nos activités</h2>
        <p>Le Nostra Circuit vous propose :</p>
        <ul className="document-list document-list-columns">
          {activities.map((activity) => <li key={activity}>{activity}</li>)}
        </ul>
      </section>

      <section className="document-section">
        <h2>🏆 Nos valeurs</h2>
        <p>Au Nostra Circuit, nous mettons un point d’honneur à promouvoir :</p>
        <ul className="document-list value-list">
          {values.map((value) => <li key={value}>✅ {value}</li>)}
        </ul>
        <p>
          Chaque participant est invité à respecter les règlements afin de garantir une expérience agréable pour tous.
        </p>
      </section>

      <section className="document-section">
        <h2>🚦 Nos installations</h2>
        <p>Le complexe comprend notamment :</p>
        <div className="facility-grid">
          {facilities.map((facility) => (
            <div className="facility-card" key={facility.text}>
              <span aria-hidden="true">{facility.icon}</span>
              <strong>{facility.text}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="document-section">
        <h2>📅 Réservations</h2>
        <p>Le circuit est accessible sur réservation.</p>
        <p>Les réservations peuvent être effectuées directement via les salons prévus à cet effet sur notre Discord.</p>
        <p>
          Toutes les demandes sont étudiées par notre équipe afin de garantir la meilleure organisation possible.
        </p>
      </section>

      <section className="document-section">
        <h2>🤝 Rejoignez l’aventure</h2>
        <p>Que vous souhaitiez :</p>
        <ul className="document-list adventure-list">
          <li>🏎️ Créer votre propre écurie</li>
          <li>🎯 Battre les records du circuit</li>
          <li>📸 Organiser un événement</li>
          <li>ou simplement profiter d’une session entre amis,</li>
        </ul>
        <p>toute l’équipe du <strong>NOSTRA CIRCUIT</strong> sera ravie de vous accueillir.</p>
      </section>

      <footer className="document-signature">
        <strong>🏁 NOSTRA CIRCUIT</strong>
        <blockquote>« Chaque virage est un défi. Chaque victoire entre dans la légende. »</blockquote>
      </footer>
    </article>
  );
}
