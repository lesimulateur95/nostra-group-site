/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import { VehicleFavoriteControls } from "@/components/motors/vehicle-favorite-controls";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getMyFavoriteVehicles } from "@/lib/favorites/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPrice(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function ProfileFavoritesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const collection = await getMyFavoriteVehicles(data.user.id);
  const activeAlerts = collection.favorites.filter(
    (favorite) => favorite.stockAlert,
  ).length;

  return (
    <main className={styles.page}>
      <ProfileSectionHeader
        eyebrow="NOSTRA MOTORS"
        title="Mes véhicules favoris"
        description="Retrouve les véhicules enregistrés et active une alerte lorsqu’un modèle indisponible revient en stock."
      />

      {!collection.configured ? (
        <section className={styles.panel}>
          <p className={styles.eyebrow}>ACTIVATION SUPABASE REQUISE</p>
          <h2>Le module des favoris n’est pas encore activé</h2>
          <p>Exécute la migration Supabase V77 puis recharge cette page.</p>
          {collection.error && (
            <div className={styles.error}>{collection.error}</div>
          )}
        </section>
      ) : (
        <>
          <section className={styles.summary}>
            <article>
              <span>Favoris enregistrés</span>
              <strong>{collection.favorites.length}</strong>
            </article>
            <article>
              <span>Alertes actives</span>
              <strong>{activeAlerts}</strong>
            </article>
          </section>

          {collection.error && (
            <div className={styles.error}>{collection.error}</div>
          )}

          {collection.favorites.length === 0 ? (
            <section className={styles.empty}>
              <span aria-hidden="true">☆</span>
              <h2>Aucun véhicule favori</h2>
              <p>
                Utilise le bouton « Ajouter aux favoris » dans l’un des trois
                catalogues Nostra Motors.
              </p>
              <Link className={styles.primaryLink} href="/motors/catalogue">
                Ouvrir le catalogue
              </Link>
            </section>
          ) : (
            <section className={styles.grid}>
              {collection.favorites.map((vehicle) => (
                <article className={styles.card} key={vehicle.id}>
                  <div className={styles.media}>
                    {vehicle.imageUrl ? (
                      <img
                        src={vehicle.imageUrl}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                      />
                    ) : (
                      <span>NM</span>
                    )}
                  </div>

                  <div className={styles.copy}>
                    <p className={styles.eyebrow}>{vehicle.catalogLabel}</p>
                    <h2>
                      {vehicle.brand} {vehicle.model}
                    </h2>
                    <div className={styles.meta}>
                      <strong>{formatPrice(vehicle.price)}</strong>
                      <span
                        className={
                          vehicle.stockQuantity > 0
                            ? styles.available
                            : styles.unavailable
                        }
                      >
                        {vehicle.stockQuantity > 0
                          ? `${vehicle.stockQuantity} en stock`
                          : "Rupture de stock"}
                      </span>
                    </div>

                    <VehicleFavoriteControls
                      vehicleId={vehicle.id}
                      stockQuantity={vehicle.stockQuantity}
                      initialFavorite
                      initialAlert={vehicle.stockAlert}
                      refreshOnChange
                    />

                    <Link className={styles.catalogLink} href={vehicle.catalogPath}>
                      Voir dans le catalogue →
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
