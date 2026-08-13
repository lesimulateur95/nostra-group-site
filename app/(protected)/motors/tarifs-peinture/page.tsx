import { EditablePage } from "@/components/site/editable-page";
import styles from "./page.module.css";

const pricingFactors = [
  {
    title: "Gabarit du véhicule",
    text: "La surface à préparer et à peindre varie selon qu’il s’agit d’une compacte, d’une berline, d’un SUV, d’une sportive ou d’un utilitaire.",
  },
  {
    title: "Type de peinture",
    text: "Teinte unie, métallisée, nacrée, bi-ton ou finition spécifique : la technique et les produits utilisés influencent le tarif final.",
  },
  {
    title: "État de la carrosserie",
    text: "Une préparation supplémentaire peut être nécessaire si la carrosserie présente des défauts, impacts ou éléments à reprendre avant peinture.",
  },
  {
    title: "Complexité de la finition",
    text: "Les démontages, masquages, détails de carrosserie et demandes particulières sont pris en compte dans le devis.",
  },
];

export default function PaintPricingPage() {
  const fallback = (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span>NOSTRA MOTORS · ATELIER PEINTURE</span>
        <h1>Tarifs peinture</h1>
        <p>
          Chaque changement de peinture est réalisé sur devis. Le tarif dépend du véhicule,
          de sa carrosserie, de la teinte choisie et du niveau de finition demandé.
        </p>
      </section>

      <section className={styles.notice}>
        <div className={styles.noticeBadge}>24–48 H</div>
        <div>
          <span>IMMOBILISATION EN CONCESSION</span>
          <h2>Un travail professionnel demande du temps.</h2>
          <p>
            Tout changement de peinture immobilise le véhicule entre <strong>24 et 48 heures</strong>
            dans notre concession. Ce délai permet à l’équipe Nostra Motors de préparer correctement
            la carrosserie, protéger les éléments du véhicule, appliquer la nouvelle teinte,
            respecter les temps de séchage et effectuer les contrôles de finition avant restitution.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <header>
          <span>TARIFICATION PERSONNALISÉE</span>
          <h2>Un tarif adapté à chaque véhicule</h2>
          <p>
            Il n’existe pas de tarif unique : le montant est défini après étude du véhicule et de la prestation souhaitée.
          </p>
        </header>
        <div className={styles.grid}>
          {pricingFactors.map((factor) => (
            <article className={styles.card} key={factor.title}>
              <span>SUR DEVIS</span>
              <h3>{factor.title}</h3>
              <p>{factor.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.process}>
        <div>
          <span>01</span>
          <strong>Étude du véhicule</strong>
          <p>Identification du modèle, de la surface à traiter et de l’état général de la carrosserie.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Choix de la finition</strong>
          <p>Validation de la teinte, du rendu souhaité et des éventuelles demandes spécifiques.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Devis Nostra Motors</strong>
          <p>Le tarif définitif et le délai d’immobilisation sont confirmés avant toute intervention.</p>
        </div>
      </section>

      <section className={styles.footerNote}>
        <span>À RETENIR</span>
        <p>
          <strong>Tarif selon le véhicule · Immobilisation 24 à 48 h · Intervention réalisée en concession.</strong>
          Aucune mise en peinture n’est engagée avant validation du tarif par le client.
        </p>
      </section>
    </main>
  );

  return (
    <EditablePage
      slug="motors-tarifs-peinture"
      eyebrow="Nostra Motors · Atelier peinture"
      defaultTitle="Tarifs peinture"
    >
      {fallback}
    </EditablePage>
  );
}
