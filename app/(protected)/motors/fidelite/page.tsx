import Image from "next/image";

import { EditablePage } from "@/components/site/editable-page";
import styles from "./page.module.css";

const loyaltyCards = [
  {
    key: "silver",
    name: "Silver",
    subtitle: "La première étape du programme Nostra Motors",
    image: "/nostra-motors/fidelite/carte-silver.webp",
    alt: "Carte de fidélité Silver Nostra Motors, recto et verso",
  },
  {
    key: "gold",
    name: "Gold",
    subtitle: "Des avantages renforcés pour nos clients fidèles",
    image: "/nostra-motors/fidelite/carte-gold.webp",
    alt: "Carte de fidélité Gold Nostra Motors, recto et verso",
  },
  {
    key: "black",
    name: "Black Signature",
    subtitle: "Le niveau d’excellence du programme Nostra Motors",
    image:
      "/nostra-motors/fidelite/carte-black-signature.webp",
    alt:
      "Carte de fidélité Black Signature Nostra Motors, recto et verso",
  },
] as const;

export default function FidelitePage() {
  const fallback = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">PROGRAMME CLIENTS</p>
        <h1 className="page-title">
          Programme de fidélité Nostra Motors
        </h1>
        <p className="lead">
          Découvrez les trois niveaux de fidélité et les avantages
          réservés aux clients Nostra Motors.
        </p>
      </header>
    </article>
  );

  return (
    <main className={styles.page}>
      <EditablePage
        slug="motors-fidelite"
        eyebrow="Nostra Motors"
        defaultTitle="Programme de fidélité"
      >
        {fallback}
      </EditablePage>

      <section
        className={styles.showcase}
        aria-labelledby="loyalty-cards-title"
      >
        <header className={styles.showcaseHeader}>
          <span className={styles.eyebrow}>
            NOSTRA MOTORS · PROGRAMME DE FIDÉLITÉ
          </span>
          <h2 id="loyalty-cards-title">
            Nos cartes de fidélité
          </h2>
          <p>
            Consultez le recto, le verso et les avantages de chaque
            niveau. Cliquez sur une carte pour l’ouvrir en grand.
          </p>
        </header>

        <div className={styles.cards}>
          {loyaltyCards.map((card, index) => (
            <article
              className={`${styles.card} ${
                styles[card.key]
              }`}
              key={card.key}
            >
              <header className={styles.cardHeader}>
                <div>
                  <span>NIVEAU {index + 1}</span>
                  <h3>{card.name}</h3>
                </div>

                <p>{card.subtitle}</p>
              </header>

              <a
                className={styles.imageLink}
                href={card.image}
                target="_blank"
                rel="noreferrer"
                aria-label={`Ouvrir la carte ${card.name} en grand`}
              >
                <Image
                  className={styles.cardImage}
                  src={card.image}
                  alt={card.alt}
                  width={1536}
                  height={1024}
                  sizes="(max-width: 760px) 96vw, 1280px"
                  priority={index === 0}
                />
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
