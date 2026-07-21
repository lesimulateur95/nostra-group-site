import Image from "next/image";

import styles from "./page.module.css";

const championshipTracks = [
  {
    key: "rouge",
    colorLabel: "TRACÉ ROUGE",
    title: "Grand Prix Long",
    description:
      "Le tracé principal utilisé pour les épreuves longues du championnat GT3 RS.",
    image:
      "/nostra-circuit/championnat-gt3rs/circuit-rouge-grand-prix-long.webp",
    alt:
      "Tracé rouge du Nostra Circuit, Grand Prix Long, championnat GT3 RS",
  },
  {
    key: "bleu",
    colorLabel: "TRACÉ BLEU",
    title: "Grand Prix Standard",
    description:
      "Le tracé standard du championnat GT3 RS.",
    image:
      "/nostra-circuit/championnat-gt3rs/circuit-bleu-grand-prix-standard.webp",
    alt:
      "Tracé bleu du Nostra Circuit, Grand Prix Standard, championnat GT3 RS",
  },
  {
    key: "jaune",
    colorLabel: "TRACÉ JAUNE",
    title: "Sprint / Qualification",
    description:
      "Le tracé réservé aux courses sprint et aux qualifications du championnat GT3 RS.",
    image:
      "/nostra-circuit/championnat-gt3rs/circuit-jaune-sprint-qualification.webp",
    alt:
      "Tracé jaune du Nostra Circuit, Sprint et Qualification, championnat GT3 RS",
  },
] as const;

export default function Gt3ChampionshipTracksPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span>
          NOSTRA CIRCUIT · CHAMPIONNAT GT3 RS
        </span>

        <h1>Circuit du championnat</h1>

        <p>
          Retrouvez les trois configurations officielles
          utilisées pendant le championnat GT3 RS.
        </p>
      </section>

      <section
        className={styles.trackList}
        aria-label="Tracés du championnat GT3 RS"
      >
        {championshipTracks.map((track, index) => (
          <article
            className={`${styles.trackCard} ${
              styles[track.key]
            }`}
            key={track.key}
          >
            <header className={styles.trackHeader}>
              <div>
                <span>
                  CIRCUIT OFFICIEL {index + 1}
                </span>
                <h2>{track.colorLabel}</h2>
              </div>

              <div className={styles.trackType}>
                <span>FORMAT</span>
                <strong>{track.title}</strong>
              </div>
            </header>

            <a
              className={styles.imageLink}
              href={track.image}
              target="_blank"
              rel="noreferrer"
              aria-label={`Ouvrir ${track.colorLabel} en grand`}
            >
              <Image
                className={styles.trackImage}
                src={track.image}
                alt={track.alt}
                width={2048}
                height={682}
                sizes="(max-width: 900px) 96vw, 1400px"
                priority={index === 0}
              />
            </a>

            <footer className={styles.trackFooter}>
              <p>{track.description}</p>

              <a
                href={track.image}
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir en pleine taille ↗
              </a>
            </footer>
          </article>
        ))}
      </section>
    </main>
  );
}
