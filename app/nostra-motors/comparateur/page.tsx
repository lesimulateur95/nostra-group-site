import Link from "next/link";
import { VehicleComparator } from "@/components/motors/vehicle-comparator";
import { getPublicCatalogVehiclesV41 } from "@/lib/nostra-motors/v41-data";
import styles from "@/components/motors/v41.module.css";

export default async function MotorsComparatorPage() {
  const vehicles = await getPublicCatalogVehiclesV41();

  return (
    <main className={styles.publicPage}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA MOTORS</span>
        <h1>Comparateur de véhicules</h1>
        <p className={styles.muted}>
          Cette page utilise le même comparateur prévu pour être affiché directement dans le catalogue.
        </p>
      </section>
      <VehicleComparator vehicles={vehicles} />
      <div className={styles.actions} style={{ marginTop: 20 }}>
        <Link className={styles.secondaryButton} href="/nostra-motors/catalogue">
          Retour au catalogue
        </Link>
      </div>
    </main>
  );
}
