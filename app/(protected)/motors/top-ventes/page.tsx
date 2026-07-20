import Link from "next/link";

import { getTopSaleVehicles } from "@/lib/nostra-motors/top-sales";
import styles from "@/components/motors/motors-services.module.css";

function money(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Prix sur demande";

  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function TopSalesPage() {
  const topSales = await getTopSaleVehicles();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA MOTORS</span>
        <h1>Véhicules en top vente</h1>
        <p>
          Les modèles actuellement sélectionnés et mis en avant par la
          Direction Nostra Motors.
        </p>
      </section>

      {topSales.length === 0 ? (
        <section className={styles.empty}>
          Aucun véhicule n’est actuellement annoncé en top vente.
        </section>
      ) : (
        <section className={styles.vehicleGrid}>
          {topSales.map(({ announcement, vehicle, label }) => {
            const imageUrl = vehicle.image_url ?? vehicle.photo_url;

            return (
              <article className={styles.vehicleCard} key={announcement.id}>
                <div className={styles.vehicleImage}>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={label} />
                  ) : (
                    <span>NM</span>
                  )}
                </div>

                <div className={styles.vehicleBody}>
                  <span className={styles.eyebrow}>TOP VENTE</span>
                  <h2>{label}</h2>
                  <strong>{money(vehicle.price)}</strong>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className={styles.actions}>
        <Link className={styles.secondaryButton} href="/accueil">
          Retour à l’accueil
        </Link>
        <Link className={styles.primaryLink} href="/motors/catalogue">
          Voir tout le catalogue
        </Link>
      </div>
    </main>
  );
}
