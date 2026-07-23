/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import {
  garageStatusLabel,
  getStaffGarageVehicles,
  type GarageVehicleStatus,
} from "@/lib/garage/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STAFF_ROLES = new Set(["manager", "commercial", "employee"]);

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function title(brand: string | null, model: string | null, fallback: string) {
  return `${brand ?? ""} ${model ?? ""}`.trim() || fallback;
}

function countStatus(
  statuses: GarageVehicleStatus[],
  status: GarageVehicleStatus,
): number {
  return statuses.filter((value) => value === status).length;
}

export default async function StaffGarageVehiclesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => STAFF_ROLES.has(role))) redirect("/dashboard");

  const collection = await getStaffGarageVehicles();
  const statuses = collection.vehicles.map((vehicle) => vehicle.garageStatus);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>DIRECTION · NOSTRA MOTORS</p>
          <h1>Garage des citoyens</h1>
          <p>
            Consulte les véhicules liés aux commandes, leur propriétaire, leur
            avancement et leur mode de livraison.
          </p>
        </div>
        <Link href="/dashboard">← Retour au Dashboard</Link>
      </section>

      {!collection.configured ? (
        <section className={styles.activation}>
          <p className={styles.eyebrow}>ACTIVATION SUPABASE REQUISE</p>
          <h2>Le garage des citoyens n’est pas encore activé</h2>
          <p>Exécute la migration Supabase V78 puis recharge cette page.</p>
          {collection.error && <code>{collection.error}</code>}
        </section>
      ) : (
        <>
          <section className={styles.summary}>
            <article>
              <span>Total</span>
              <strong>{collection.vehicles.length}</strong>
            </article>
            <article>
              <span>En préparation</span>
              <strong>{countStatus(statuses, "preparing")}</strong>
            </article>
            <article>
              <span>Prêts</span>
              <strong>{countStatus(statuses, "ready")}</strong>
            </article>
            <article>
              <span>Livrés</span>
              <strong>{countStatus(statuses, "delivered")}</strong>
            </article>
          </section>

          {collection.error && (
            <div className={styles.warning}>{collection.error}</div>
          )}

          {collection.vehicles.length === 0 ? (
            <section className={styles.empty}>
              <span>🚘</span>
              <h2>Aucun véhicule enregistré</h2>
              <p>
                Les véhicules seront ajoutés automatiquement depuis les
                commandes Nostra Motors existantes et futures.
              </p>
            </section>
          ) : (
            <section className={styles.list}>
              {collection.vehicles.map((vehicle) => {
                const vehicleTitle = title(
                  vehicle.brand,
                  vehicle.model,
                  vehicle.vehicleName,
                );

                return (
                  <article className={styles.vehicle} key={vehicle.id}>
                    <div className={styles.media}>
                      {vehicle.imageUrl ? (
                        <img src={vehicle.imageUrl} alt={vehicleTitle} />
                      ) : (
                        <span>NM</span>
                      )}
                    </div>

                    <div className={styles.copy}>
                      <div className={styles.heading}>
                        <div>
                          <p className={styles.customer}>{vehicle.customerName}</p>
                          <h2>{vehicleTitle}</h2>
                        </div>
                        <span
                          className={`${styles.status} ${styles[vehicle.garageStatus]}`}
                        >
                          {garageStatusLabel(vehicle.garageStatus)}
                        </span>
                      </div>

                      <dl>
                        <div>
                          <dt>Commande</dt>
                          <dd>{vehicle.orderNumber}</dd>
                        </div>
                        <div>
                          <dt>Prix</dt>
                          <dd>{money(vehicle.purchasePrice)}</dd>
                        </div>
                        <div>
                          <dt>Livraison</dt>
                          <dd>
                            {vehicle.deliveryAddress ||
                              vehicle.deliveryMode ||
                              "Retrait au showroom"}
                          </dd>
                        </div>
                        <div>
                          <dt>Dernière mise à jour</dt>
                          <dd>
                            {new Date(vehicle.updatedAt).toLocaleString("fr-FR")}
                          </dd>
                        </div>
                      </dl>

                      <div className={styles.actions}>
                        <Link href="/dashboard/commandes">
                          Ouvrir les commandes
                        </Link>
                        <Link href="/dashboard/citoyens">
                          Ouvrir les fiches citoyens
                        </Link>
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
