/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import {
  garageStatusLabel,
  getMyGarageVehicles,
} from "@/lib/garage/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function vehicleTitle(brand: string | null, model: string | null, name: string) {
  const catalogName = `${brand ?? ""} ${model ?? ""}`.trim();
  return catalogName || name;
}

export default async function ProfileGaragePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const collection = await getMyGarageVehicles(data.user.id);
  const delivered = collection.vehicles.filter(
    (vehicle) => vehicle.garageStatus === "delivered",
  ).length;
  const inProgress = collection.vehicles.length - delivered;

  return (
    <main className={styles.page}>
      <ProfileSectionHeader
        eyebrow="NOSTRA MOTORS"
        title="Mon garage"
        description="Retrouve les véhicules liés à tes commandes, leur avancement, leur livraison et tous les documents associés."
      />

      {!collection.configured ? (
        <section className={styles.activation}>
          <p className={styles.eyebrow}>ACTIVATION SUPABASE REQUISE</p>
          <h2>Le garage personnel n’est pas encore activé</h2>
          <p>Exécute la migration Supabase V78 puis recharge cette page.</p>
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
              <span>Livrés</span>
              <strong>{delivered}</strong>
            </article>
            <article>
              <span>En cours</span>
              <strong>{inProgress}</strong>
            </article>
          </section>

          {collection.error && (
            <div className={styles.warning}>{collection.error}</div>
          )}

          {collection.vehicles.length === 0 ? (
            <section className={styles.empty}>
              <span aria-hidden="true">🚘</span>
              <h2>Ton garage est vide</h2>
              <p>
                Les véhicules apparaissent automatiquement dès qu’une commande
                Nostra Motors est enregistrée.
              </p>
              <Link className={styles.primaryLink} href="/motors/catalogue">
                Ouvrir le catalogue
              </Link>
            </section>
          ) : (
            <section className={styles.grid}>
              {collection.vehicles.map((vehicle) => {
                const title = vehicleTitle(
                  vehicle.brand,
                  vehicle.model,
                  vehicle.vehicleName,
                );

                return (
                  <article className={styles.card} key={vehicle.id}>
                    <div className={styles.media}>
                      {vehicle.imageUrl ? (
                        <img src={vehicle.imageUrl} alt={title} />
                      ) : (
                        <span>NM</span>
                      )}
                    </div>

                    <div className={styles.copy}>
                      <div className={styles.headingRow}>
                        <div>
                          <p className={styles.eyebrow}>NOSTRA MOTORS</p>
                          <h2>{title}</h2>
                        </div>
                        <span
                          className={`${styles.status} ${styles[vehicle.garageStatus]}`}
                        >
                          {garageStatusLabel(vehicle.garageStatus)}
                        </span>
                      </div>

                      <dl className={styles.metaGrid}>
                        <div>
                          <dt>Commande</dt>
                          <dd>{vehicle.orderNumber}</dd>
                        </div>
                        <div>
                          <dt>Prix</dt>
                          <dd>{money(vehicle.purchasePrice)}</dd>
                        </div>
                        <div>
                          <dt>Date</dt>
                          <dd>
                            {new Date(
                              vehicle.acquiredAt ?? vehicle.createdAt,
                            ).toLocaleDateString("fr-FR")}
                          </dd>
                        </div>
                        <div>
                          <dt>Livraison</dt>
                          <dd>
                            {vehicle.deliveryAddress ||
                              vehicle.deliveryMode ||
                              "Showroom Nostra Motors"}
                          </dd>
                        </div>
                      </dl>

                      <div className={styles.actions}>
                        <Link
                          className={styles.primaryLink}
                          href={`/profil/garage/${vehicle.id}`}
                        >
                          Ouvrir la fiche véhicule
                        </Link>
                        <Link href="/profil/documents">Mes documents</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </main>
  );
}
