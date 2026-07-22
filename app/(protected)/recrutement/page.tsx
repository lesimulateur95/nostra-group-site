import Link from "next/link";

import { Topbar } from "@/components/site/topbar";
import styles from "./page.module.css";

const departments = [
  {
    icon: "◆",
    eyebrow: "NOSTRA MOTORS",
    title: "Automobile & relation client",
    description:
      "Rejoignez la concession pour accompagner les citoyens, présenter les véhicules et participer à la qualité du service Nostra Motors.",
    roles: [
      "Conseiller commercial",
      "Vendeur automobile",
      "Préparateur de véhicules",
      "Livreur Nostra Motors",
    ],
  },
  {
    icon: "◉",
    eyebrow: "NOSTRA CIRCUIT",
    title: "Sport automobile",
    description:
      "Participez à l’organisation des activités piste, à la sécurité des courses et au bon déroulement des événements sportifs.",
    roles: [
      "Commissaire de course",
      "Chronométrage et tours",
      "Organisation de piste",
      "Accueil des pilotes",
    ],
  },
  {
    icon: "✦",
    eyebrow: "NOSTRA GROUP",
    title: "Événementiel & administration",
    description:
      "Contribuez aux événements, à la communication et au fonctionnement quotidien des différentes activités du groupe.",
    roles: [
      "Organisation d’événements",
      "Communication",
      "Accueil des citoyens",
      "Administration",
    ],
  },
] as const;

export default function RecruitmentPage() {
  return (
    <div className="site-shell">
      <Topbar />

      <main className={styles.page}>
        <section className={styles.hero}>
          <span>RECRUTEMENT · NOSTRA GROUP</span>

          <h1>Construisez la suite avec nous.</h1>

          <p>
            Nostra Group rassemble l’automobile de prestige, le
            sport automobile et l’événementiel. Découvrez les
            différents domaines dans lesquels vous pouvez rejoindre
            l’équipe.
          </p>

          <div className={styles.heroActions}>
            <Link href="/recrutement/candidature">Déposer ma candidature</Link>
            <a href="#postes">Découvrir les métiers</a>
          </div>
        </section>

        <section
          className={styles.departments}
          id="postes"
          aria-labelledby="departments-title"
        >
          <header className={styles.sectionHeader}>
            <span>OPPORTUNITÉS</span>
            <h2 id="departments-title">
              Dans quel univers souhaitez-vous évoluer&nbsp;?
            </h2>
            <p>
              Les disponibilités précises sont communiquées par la
              Direction. Cette page présente les principaux métiers
              pouvant être ouverts au recrutement.
            </p>
          </header>

          <div className={styles.departmentGrid}>
            {departments.map((department) => (
              <article
                className={styles.department}
                key={department.eyebrow}
              >
                <div
                  className={styles.departmentIcon}
                  aria-hidden="true"
                >
                  {department.icon}
                </div>

                <span>{department.eyebrow}</span>
                <h3>{department.title}</h3>
                <p>{department.description}</p>

                <ul>
                  {department.roles.map((role) => (
                    <li key={role}>{role}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.application}>
          <div>
            <span>COMMENT POSTULER&nbsp;?</span>
            <h2>Présentez votre candidature à la Direction</h2>
            <p>
              Préparez une courte présentation, le poste recherché,
              vos disponibilités et vos motivations. Envoyez ensuite
              ces informations depuis la messagerie interne du site.
            </p>
          </div>

          <div className={styles.steps}>
            <article>
              <strong>01</strong>
              <span>Choisir un domaine</span>
              <p>
                Nostra Motors, Nostra Circuit ou les activités
                générales de Nostra Group.
              </p>
            </article>

            <article>
              <strong>02</strong>
              <span>Préparer sa candidature</span>
              <p>
                Indiquer le poste souhaité, son expérience et ses
                disponibilités.
              </p>
            </article>

            <article>
              <strong>03</strong>
              <span>Contacter la Direction</span>
              <p>
                Utiliser la messagerie interne depuis votre espace
                personnel.
              </p>
            </article>
          </div>

          <Link
            className={styles.profileLink}
            href="/recrutement/candidature"
          >
            Déposer ou suivre ma candidature →
          </Link>
        </section>
      </main>
    </div>
  );
}
