/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getVehicleFavoriteStats } from "@/lib/favorites/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardVehicleFavoritesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const allowed = roles.some((role) =>
    ["manager", "commercial", "employee"].includes(role),
  );
  if (!allowed) redirect("/dashboard");

  const collection = await getVehicleFavoriteStats();
  const totalFavorites = collection.vehicles.reduce(
    (total, vehicle) => total + vehicle.favoritesCount,
    0,
  );
  const totalAlerts = collection.vehicles.reduce(
    (total, vehicle) => total + vehicle.alertsCount,
    0,
  );

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>DIRECTION · NOSTRA MOTORS</p>
            <h1>Favoris et alertes de stock</h1>
            <p>
              Repère les modèles les plus demandés et le nombre de citoyens à
              prévenir lors d’un retour en stock.
            </p>
          </div>
          <Link className={styles.backLink} href="/dashboard">
            ← Retour au Dashboard
          </Link>
        </section>

        {!collection.configured ? (
          <section className={styles.errorPanel}>
            <h2>Module non activé</h2>
            <p>Exécute la migration Supabase V77 puis recharge cette page.</p>
            {collection.error && <code>{collection.error}</code>}
          </section>
        ) : (
          <>
            <section className={styles.summary}>
              <article>
                <span>Véhicules suivis</span>
                <strong>{collection.vehicles.length}</strong>
              </article>
              <article>
                <span>Ajouts aux favoris</span>
                <strong>{totalFavorites}</strong>
              </article>
              <article>
                <span>Alertes de stock actives</span>
                <strong>{totalAlerts}</strong>
              </article>
            </section>

            {collection.vehicles.length === 0 ? (
              <section className={styles.empty}>
                <h2>Aucun favori enregistré</h2>
                <p>
                  Les statistiques apparaîtront dès qu’un citoyen ajoutera un
                  véhicule à ses favoris.
                </p>
              </section>
            ) : (
              <section className={styles.grid}>
                {collection.vehicles.map((vehicle) => (
                  <article className={styles.card} key={vehicle.vehicleId}>
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

                      <div className={styles.counters}>
                        <div>
                          <span>Favoris</span>
                          <strong>{vehicle.favoritesCount}</strong>
                        </div>
                        <div>
                          <span>Alertes actives</span>
                          <strong>{vehicle.alertsCount}</strong>
                        </div>
                      </div>

                      <div className={styles.stockRow}>
                        <span>Stock actuel</span>
                        <strong
                          className={
                            vehicle.stockQuantity > 0
                              ? styles.stockAvailable
                              : styles.stockEmpty
                          }
                        >
                          {vehicle.stockQuantity > 0
                            ? `${vehicle.stockQuantity} disponible(s)`
                            : "Rupture de stock"}
                        </strong>
                      </div>

                      <Link className={styles.catalogLink} href={vehicle.catalogPath}>
                        Ouvrir le catalogue →
                      </Link>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </DashboardShell>
  );
}
