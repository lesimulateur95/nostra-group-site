import Image from "next/image";

import { EditablePage } from "@/components/site/editable-page";
import { getPublicLoyaltyTiers } from "@/lib/loyalty/data";
import styles from "./page.module.css";

const loyaltyCards = [
  {
    code: "silver",
    key: "silver",
    name: "Silver",
    subtitle: "La première étape du programme Nostra Motors",
    image: "/nostra-motors/fidelite/carte-silver.webp",
    alt: "Carte de fidélité Silver Nostra Motors, recto et verso",
  },
  {
    code: "gold",
    key: "gold",
    name: "Gold",
    subtitle: "Des avantages renforcés pour nos clients fidèles",
    image: "/nostra-motors/fidelite/carte-gold.webp",
    alt: "Carte de fidélité Gold Nostra Motors, recto et verso",
  },
  {
    code: "black_signature",
    key: "black",
    name: "Black Signature",
    subtitle: "Le niveau d’excellence du programme Nostra Motors",
    image:
      "/nostra-motors/fidelite/carte-black-signature.webp",
    alt:
      "Carte de fidélité Black Signature Nostra Motors, recto et verso",
  },
] as const;

const fallbackBenefits: Record<string, string[]> = {
  silver: [
    "2 % sur les commandes Nostra Motors",
    "Invitation aux événements Nostra Motors",
    "2 % sur le tarif de la plaque",
  ],
  gold: [
    "Tous les avantages Silver",
    "5 % sur les commandes Nostra Motors",
    "2 % pour chaque peinture",
    "Invitation aux événements",
    "1 ticket de tombola offert par événement",
    "1 carton de Bingo offert par événement",
    "Essai offert sur une sélection de véhicules",
  ],
  black_signature: [
    "Tous les avantages Silver et Gold",
    "15 % sur les prochaines commandes Nostra Motors",
    "Commande prioritaire",
    "Peinture offerte",
    "Plaque offerte",
    "3 tours de circuit offerts par réservation",
  ],
};

export default async function FidelitePage() {
  const tiers = await getPublicLoyaltyTiers();

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
            Les avantages affichés ci-dessous sont chargés depuis la
            base de données du site.
          </p>
        </header>

        <div className={styles.cards}>
          {loyaltyCards.map((card, index) => {
            const tier = tiers.find(
              (entry) => entry.code === card.code,
            );
            const benefits =
              tier?.benefits ??
              fallbackBenefits[card.code] ??
              [];

            return (
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

                <section className={styles.benefits}>
                  <span>AVANTAGES ENREGISTRÉS</span>
                  <ul>
                    {benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </section>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
