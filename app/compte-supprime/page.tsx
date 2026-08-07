import Link from "next/link";

import styles from "./page.module.css";

export default function DeletedAccountPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span>COMPTE SUPPRIMÉ</span>
        <h1>Ton compte Nostra Group a été supprimé.</h1>
        <p>
          La session a été fermée et l'accès au compte a été désactivé. Les
          informations personnelles utilisées par ton profil ne sont plus
          disponibles sur le site.
        </p>
        <Link className={styles.homeButton} href="/">
          Retour à l'accueil
        </Link>
      </section>
    </main>
  );
}
