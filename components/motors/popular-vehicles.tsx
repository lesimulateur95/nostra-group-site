import type { CatalogVehicleV41 } from "@/lib/nostra-motors/v41-shared";
import {
  vehicleLabel,
  vehiclePopularityScore,
} from "@/lib/nostra-motors/v41-shared";
import styles from "./v41.module.css";

type Props = {
  vehicles: CatalogVehicleV41[];
  limit?: number;
};

export function PopularVehicles({ vehicles, limit = 3 }: Props) {
  const popular = [...vehicles]
    .sort((a, b) => vehiclePopularityScore(b) - vehiclePopularityScore(a))
    .slice(0, limit);

  if (popular.length === 0) return null;

  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>LES PLUS POPULAIRES</span>
      <h2>Les véhicules qui attirent le plus les clients</h2>
      <div className={styles.vehicleGrid}>
        {popular.map((vehicle, index) => {
          const image = vehicle.image_url ?? vehicle.photo_url;
          return (
            <article className={styles.vehicleCard} key={String(vehicle.id)}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={vehicleLabel(vehicle)}
                  className={styles.vehicleImage}
                  src={String(image)}
                />
              ) : (
                <div className={styles.vehicleImage} />
              )}
              <div className={styles.vehicleBody}>
                <span className={styles.eyebrow}>TOP {index + 1}</span>
                <h3>{vehicleLabel(vehicle)}</h3>
                <p className={styles.muted}>
                  {vehicle.price ? `${Number(vehicle.price).toLocaleString("fr-FR")} €` : "Prix sur demande"}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
