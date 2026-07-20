import Link from "next/link";
import { PopularVehicles } from "@/components/motors/popular-vehicles";
import { getPublicCatalogVehiclesV41 } from "@/lib/nostra-motors/v41-data";
import styles from "@/components/motors/v41.module.css";

export default async function PopularMotorsVehiclesPage() {
  const vehicles = await getPublicCatalogVehiclesV41();

  return (
    <main className={styles.publicPage}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA MOTORS</span>
        <h1>Véhicules les plus populaires</h1>
        <p className={styles.muted}>
          Ce bloc est prêt à être intégré sur la page d’accueil du site complet.
        </p>
      </section>
      <PopularVehicles limit={6} vehicles={vehicles} />
      <div className={styles.actions} style={{ marginTop: 20 }}>
        <Link className={styles.secondaryButton} href="/accueil">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
