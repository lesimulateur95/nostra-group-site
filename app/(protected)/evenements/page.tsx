import Link from "next/link";

import { EditablePage } from "@/components/site/editable-page";

export default function EventsPage() {
  const fallback = (
    <article className="games-presentation-page">
      <header className="document-hero games-presentation-hero">
        <p className="eyebrow">NOSTRA GROUP</p>
        <h1 className="page-title">Jeux & animations</h1>
        <p className="lead">
          Découvrez les jeux proposés par Nostra Group. Les événements ponctuels
          sont annoncés au moment de leur organisation.
        </p>
      </header>

      <section className="games-presentation-grid">
        <article className="game-presentation-card">
          <span className="game-presentation-icon"></span>
          <div>
            <p className="eyebrow">JEU COLLECTIF</p>
            <h2>Bingo</h2>
          </div>
          <p>
            Le Bingo réunit les citoyens autour de cartons numérotés. Les numéros
            sont annoncés progressivement et chaque participant complète son
            carton jusqu’à atteindre l’objectif défini pour la partie.
          </p>
          <ul>
            <li>La date, l’horaire et le lot sont indiqués dans l’annonce officielle.</li>
            <li>Le nombre de cartons autorisés est précisé avant le lancement.</li>
            <li>Le gagnant est validé après contrôle de son carton.</li>
          </ul>
        </article>

        <article className="game-presentation-card">
          <span className="game-presentation-icon">🎟️</span>
          <div>
            <p className="eyebrow">TIRAGE AU SORT</p>
            <h2>Tombola</h2>
          </div>
          <p>
            La Tombola permet d’acheter un ou plusieurs tickets numérotés. Chaque
            ticket représente une chance de remporter le lot annoncé par Nostra
            Group.
          </p>
          <ul>
            <li>Le prix des tickets et le lot sont annoncés à l’ouverture.</li>
            <li>La date de clôture est communiquée avant le tirage.</li>
            <li>Le résultat est publié officiellement après le tirage au sort.</li>
          </ul>
        </article>

        <article className="game-presentation-card game-presentation-card-featured">
          <span className="game-presentation-icon">🎡</span>
          <div>
            <p className="eyebrow">23 CASES</p>
            <h2>Roue de la chance</h2>
          </div>
          <p>
            La roue contient des cases Perdu et plusieurs bonus : peintures,
            remises, tours de circuit, café, carte Silver et essai d’un véhicule
            de la concession.
          </p>
          <ul>
            <li>Chaque tirage est enregistré automatiquement au nom du citoyen.</li>
            <li>
              Les gains sont visibles dans <strong>Mon profil → Jeux</strong>.
            </li>
            <li>Le Gérant passe le gain au statut Utilisé lorsqu’il est consommé.</li>
          </ul>
          <Link
            className="btn game-presentation-link"
            href="/evenements/roue-de-la-chance"
          >
            Accéder à la roue
          </Link>
        </article>

        <article className="game-presentation-card game-presentation-card-featured">
          <span className="game-presentation-icon">🗺️</span>
          <div>
            <p className="eyebrow">ÉVÉNEMENT À INDICES</p>
            <h2>Chasse au trésor</h2>
          </div>
          <p>
            La Direction prépare une chasse, publie les règles et révèle les
            indices progressivement jusqu’à la découverte du trésor.
          </p>
          <ul>
            <li>Les indices apparaissent dans leur ordre officiel.</li>
            <li>Le lieu de départ et le lot sont annoncés avec l’événement.</li>
            <li>Le gagnant est publié lorsque la chasse est terminée.</li>
          </ul>
          <Link
            className="btn game-presentation-link"
            href="/evenements/chasse-au-tresor"
          >
            Voir les chasses au trésor
          </Link>
        </article>
      </section>
    </article>
  );

  return (
    <EditablePage
      slug="evenements-presentation-jeux"
      eyebrow="Événements & Jeux"
      defaultTitle="Jeux Nostra Group"
    >
      {fallback}
    </EditablePage>
  );
}
