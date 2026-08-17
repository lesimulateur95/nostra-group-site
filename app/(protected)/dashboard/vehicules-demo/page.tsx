/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  removeDemoVehicleV164,
  saveDemoVehicleV164,
} from "@/app/actions/v164";
import styles from "@/components/v164/v164.module.css";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  CATALOG_LABELS,
  getCatalogVehiclesV51,
} from "@/lib/catalogues-v51/data";
import { createClient } from "@/lib/supabase/server";
import {
  canMotorsV164,
  getMotorsEmployeeAccessV164,
} from "@/lib/v164/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function DemoVehiclesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    removed?: string;
    error?: string;
    q?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const manager = roles.includes("manager");
  const staff = manager || roles.includes("employee") || roles.includes("commercial");
  if (!staff) redirect("/dashboard");

  const access = await getMotorsEmployeeAccessV164(data.user.id, manager);
  const canRead = manager || canMotorsV164(access, "catalogue_read", true);
  const canManage = manager || canMotorsV164(access, "catalogue_manage", false);
  if (!canRead && !canManage) redirect("/dashboard");

  const [vehicles, params] = await Promise.all([
    getCatalogVehiclesV51({ includeUnpublished: true }),
    searchParams,
  ]);

  const q = String(params.q ?? "").trim().toLocaleLowerCase("fr-FR");
  const demos = vehicles
    .filter((vehicle) => vehicle.is_demo)
    .filter((vehicle) => {
      if (!q) return true;
      return `${vehicle.brand} ${vehicle.model} ${CATALOG_LABELS[vehicle.catalog_type]}`
        .toLocaleLowerCase("fr-FR")
        .includes(q);
    });
  const available = vehicles.filter(
    (vehicle) => !vehicle.is_demo && vehicle.catalog_type !== "used",
  );

  const publishedCount = demos.filter((vehicle) => vehicle.published).length;
  const stockCount = demos.reduce(
    (total, vehicle) => total + Math.max(0, vehicle.stock_quantity),
    0,
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>DIRECTION · NOSTRA MOTORS</span>
          <h1>Véhicules de démonstration</h1>
          <p>
            Retrouve tous les véhicules démo au même endroit, modifie leur
            kilométrage et leurs informations, ou attribue le statut démo à une
            fiche déjà présente dans un catalogue.
          </p>
        </div>
        <Link className={styles.back} href="/dashboard">
          ← Dashboard
        </Link>
      </section>

      {params.saved && (
        <div className={styles.success}>
          Le véhicule de démonstration a été enregistré.
        </div>
      )}
      {params.removed && (
        <div className={styles.success}>
          Le statut véhicule de démonstration a été retiré.
        </div>
      )}
      {params.error && (
        <div className={styles.error}>
          Impossible d’enregistrer la modification : {params.error}
        </div>
      )}

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>Véhicules démo</span>
          <strong>{vehicles.filter((vehicle) => vehicle.is_demo).length}</strong>
        </article>
        <article className={styles.stat}>
          <span>Publié(s)</span>
          <strong>{publishedCount}</strong>
        </article>
        <article className={styles.stat}>
          <span>Exemplaires en stock</span>
          <strong>{stockCount}</strong>
        </article>
        <article className={styles.stat}>
          <span>Fiches disponibles</span>
          <strong>{available.length}</strong>
        </article>
      </section>

      {canManage && (
        <section className={styles.card}>
          <span className={styles.eyebrow}>ATTRIBUER LE STATUT DÉMO</span>
          <h2>Ajouter un véhicule existant</h2>
          <p className={styles.muted}>
            Le véhicule reste dans son catalogue actuel. Aucune nouvelle fiche
            n’est créée : on active simplement son statut démonstration.
          </p>

          {available.length > 0 ? (
            <form className={styles.form} action={saveDemoVehicleV164}>
              <div className={styles.formGrid}>
                <label>
                  Véhicule
                  <select name="vehicle_id" required defaultValue="">
                    <option value="">Sélectionner un véhicule</option>
                    {available.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} {vehicle.model} · {CATALOG_LABELS[vehicle.catalog_type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Kilométrage démo
                  <input
                    type="number"
                    min="0"
                    name="demo_mileage"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Prix neuf / avant remise (€)
                  <input
                    name="demo_original_price"
                    inputMode="decimal"
                    placeholder="Optionnel"
                  />
                </label>
                <label>
                  Note démonstration
                  <input
                    name="demo_note"
                    placeholder="Ex. véhicule d’exposition, faible kilométrage…"
                  />
                </label>
              </div>
              <button className={styles.button}>Passer en démonstration</button>
            </form>
          ) : (
            <p className={styles.muted}>
              Tous les véhicules disponibles sont déjà marqués comme
              démonstration.
            </p>
          )}
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.row}>
          <div>
            <span className={styles.eyebrow}>PARC DÉMONSTRATION</span>
            <h2>Tous les véhicules démo</h2>
          </div>
          <form className={styles.search} method="get">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Marque, modèle ou catalogue…"
            />
            <button className={styles.buttonAlt}>Rechercher</button>
          </form>
        </div>
      </section>

      <section className={styles.list}>
        {demos.map((vehicle) => {
          const image = vehicle.images[0]?.url ?? null;
          const discount =
            vehicle.demo_original_price != null &&
            vehicle.demo_original_price > vehicle.price
              ? vehicle.demo_original_price - vehicle.price
              : 0;

          return (
            <article className={styles.card} key={vehicle.id}>
              <div className={styles.row}>
                <div>
                  <span className={styles.eyebrow}>
                    {CATALOG_LABELS[vehicle.catalog_type]}
                  </span>
                  <h2>
                    {vehicle.brand} {vehicle.model}
                  </h2>
                  <p className={styles.muted}>
                    {vehicle.published ? "Publié" : "Masqué"} · Stock : {vehicle.stock_quantity}
                  </p>
                </div>
                <span className={styles.pill}>
                  DÉMO · {vehicle.demo_mileage.toLocaleString("fr-FR")} km
                </span>
              </div>

              <div className={styles.grid2}>
                <div className={styles.item}>
                  {image ? (
                    <img
                      src={image}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      style={{
                        display: "block",
                        width: "100%",
                        maxHeight: 260,
                        objectFit: "cover",
                        borderRadius: 12,
                      }}
                    />
                  ) : (
                    <p className={styles.muted}>Aucune photo enregistrée.</p>
                  )}
                  <div style={{ marginTop: 12 }}>
                    <p>Prix actuel : <strong>{money(vehicle.price)}</strong></p>
                    <p>Prix neuf : <strong>{money(vehicle.demo_original_price)}</strong></p>
                    {discount > 0 && (
                      <p>Remise démo : <strong>{money(discount)}</strong></p>
                    )}
                  </div>
                </div>

                {canManage ? (
                  <form className={styles.form} action={saveDemoVehicleV164}>
                    <input type="hidden" name="vehicle_id" value={vehicle.id} />
                    <label>
                      Kilométrage démo
                      <input
                        type="number"
                        min="0"
                        name="demo_mileage"
                        defaultValue={vehicle.demo_mileage}
                      />
                    </label>
                    <label>
                      Prix neuf / avant remise (€)
                      <input
                        name="demo_original_price"
                        inputMode="decimal"
                        defaultValue={vehicle.demo_original_price ?? ""}
                      />
                    </label>
                    <label>
                      Note démonstration
                      <textarea
                        name="demo_note"
                        defaultValue={vehicle.demo_note}
                        placeholder="Informations visibles pour le véhicule démo"
                      />
                    </label>
                    <div className={styles.row}>
                      <button className={styles.button}>Enregistrer</button>
                      <Link
                        className={styles.buttonAlt}
                        href={`/dashboard/catalogue#vehicule-${vehicle.id}`}
                      >
                        Fiche catalogue complète
                      </Link>
                    </div>
                  </form>
                ) : (
                  <div className={styles.item}>
                    <h3>Informations démonstration</h3>
                    <p>{vehicle.demo_note || "Aucune note."}</p>
                    <Link
                      className={styles.buttonAlt}
                      href={`/dashboard/catalogue#vehicule-${vehicle.id}`}
                    >
                      Voir la fiche catalogue
                    </Link>
                  </div>
                )}
              </div>

              {canManage && (
                <form action={removeDemoVehicleV164}>
                  <input type="hidden" name="vehicle_id" value={vehicle.id} />
                  <button className={styles.danger}>
                    Retirer le statut démonstration
                  </button>
                </form>
              )}
            </article>
          );
        })}

        {demos.length === 0 && (
          <section className={styles.card}>
            <h2>Aucun véhicule de démonstration</h2>
            <p className={styles.muted}>
              {q
                ? "Aucun véhicule démo ne correspond à cette recherche."
                : "Utilise le formulaire ci-dessus pour attribuer le statut démonstration à un véhicule existant."}
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
