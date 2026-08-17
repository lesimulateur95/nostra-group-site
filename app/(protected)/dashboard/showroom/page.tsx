/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  saveDemoUnitV1643,
  setShowroomAndDemoQuantitiesV1645,
} from "@/app/actions/showroom-v1643";
import styles from "@/components/v164/v164.module.css";
import { getUserRoleKeys } from "@/lib/auth/access";
import { CATALOG_LABELS } from "@/lib/catalogues-v51/data";
import { getShowroomManagementV1643 } from "@/lib/showroom-v1643/data";
import { createClient } from "@/lib/supabase/server";
import { canMotorsV164, getMotorsEmployeeAccessV164 } from "@/lib/v164/data";

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

export default async function ShowroomManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; q?: string; only?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const manager = roles.includes("manager");
  const legacyStaff = roles.some((role) => ["employee", "commercial"].includes(role));
  const access = await getMotorsEmployeeAccessV164(data.user.id, manager);
  const canManage =
    manager ||
    canMotorsV164(access, "inventory_manage", legacyStaff) ||
    canMotorsV164(access, "catalogue_manage", false);
  if (!canManage) redirect("/dashboard");

  const [params, management] = await Promise.all([
    searchParams,
    getShowroomManagementV1643(),
  ]);

  const q = String(params.q ?? "").trim().toLocaleLowerCase("fr-FR");
  const onlyShowroom = params.only === "showroom";

  const filtered = management.vehicles
    .filter((entry) => !onlyShowroom || entry.showroomCount > 0)
    .filter((entry) => {
      if (!q) return true;
      const haystack = `${entry.vehicle.brand} ${entry.vehicle.model} ${CATALOG_LABELS[entry.vehicle.catalog_type]}`
        .toLocaleLowerCase("fr-FR");
      return haystack.includes(q);
    })
    .sort((a, b) => {
      if (a.showroomCount !== b.showroomCount) return b.showroomCount - a.showroomCount;
      return `${a.vehicle.brand} ${a.vehicle.model}`.localeCompare(
        `${b.vehicle.brand} ${b.vehicle.model}`,
        "fr-FR",
      );
    });

  const totalShowroom = management.vehicles.reduce((sum, entry) => sum + entry.showroomCount, 0);
  const totalDemo = management.vehicles.reduce((sum, entry) => sum + entry.demoCount, 0);
  const showroomModels = management.vehicles.filter((entry) => entry.showroomCount > 0).length;
  const allocatable = management.vehicles.reduce((sum, entry) => sum + entry.allocatableCount, 0);

  const errorMessages: Record<string, string> = {
    invalid: "Vérifie le véhicule ou la quantité demandée.",
    quantity: "Il n’y a pas assez d’exemplaires physiques disponibles pour envoyer cette quantité au showroom.",
    demo: "Impossible de retirer autant d’exemplaires : certains sont encore marqués comme véhicules de démonstration.",
    "demo-quantity": "Le nombre de véhicules de démonstration ne peut pas dépasser le nombre d’exemplaires présents au showroom.",
    showroom: "Cet exemplaire n’est plus au showroom.",
    "not-found": "Le véhicule ou l’exemplaire n’existe plus.",
    forbidden: "Tu n’as pas la permission de gérer le showroom.",
    setup: "Exécute le SQL V164.3 Supabase avant d’utiliser la gestion du showroom.",
    save: "Impossible d’enregistrer la modification du showroom.",
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>DIRECTION · NOSTRA MOTORS</span>
          <h1>Gestion Showroom</h1>
          <p>
            Gère les exemplaires physiques réellement présents au showroom. Une fiche catalogue avec
            6 véhicules peut par exemple conserver 5 exemplaires en stock et n’en envoyer qu’un seul au showroom.
          </p>
        </div>
        <Link className={styles.back} href="/dashboard">← Dashboard</Link>
      </section>

      {params.saved && (
        <div className={styles.success}>
          {params.saved === "demo"
            ? "L’exemplaire de démonstration a été mis à jour."
            : params.saved === "quantities"
              ? "Les quantités showroom et démonstration ont été mises à jour."
              : "Le nombre d’exemplaires présents au showroom a été mis à jour."}
        </div>
      )}
      {params.error && <div className={styles.error}>{errorMessages[params.error] ?? errorMessages.save}</div>}

      {!management.configured ? (
        <section className={styles.card}>
          <span className={styles.eyebrow}>SUPABASE REQUIS</span>
          <h2>Gestion par exemplaire non installée</h2>
          <p className={styles.muted}>
            Exécute <strong>supabase/nostra-v1643-gestion-showroom-unites.sql</strong>. Cette migration
            sépare le stock catalogue, le showroom et les véhicules de démonstration.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.stats}>
            <article className={styles.stat}><span>Modèles au showroom</span><strong>{showroomModels}</strong></article>
            <article className={styles.stat}><span>Exemplaires au showroom</span><strong>{totalShowroom}</strong></article>
            <article className={styles.stat}><span>Exemplaires démo</span><strong>{totalDemo}</strong></article>
            <article className={styles.stat}><span>Exemplaires mobilisables</span><strong>{allocatable}</strong></article>
          </section>

          <section className={styles.card}>
            <div className={styles.row}>
              <div>
                <span className={styles.eyebrow}>PARC PHYSIQUE</span>
                <h2>Affectation au showroom</h2>
                <p className={styles.muted}>
                  Le nombre indiqué correspond à des exemplaires physiques, pas à toute la fiche catalogue.
                </p>
              </div>
              <form className={styles.search} method="get">
                <input name="q" defaultValue={params.q ?? ""} placeholder="Marque, modèle ou catalogue…" />
                {onlyShowroom && <input type="hidden" name="only" value="showroom" />}
                <button className={styles.buttonAlt}>Rechercher</button>
              </form>
            </div>
            <div className={styles.row} style={{ marginTop: 12 }}>
              <Link className={params.only === "showroom" ? styles.buttonAlt : styles.button} href="/dashboard/showroom">
                Tous les modèles
              </Link>
              <Link className={params.only === "showroom" ? styles.button : styles.buttonAlt} href="/dashboard/showroom?only=showroom">
                Uniquement présents au showroom
              </Link>
            </div>
          </section>

          <section className={styles.list}>
            {filtered.length === 0 && (
              <article className={styles.card}><p className={styles.muted}>Aucun véhicule ne correspond à cette recherche.</p></article>
            )}

            {filtered.map((entry) => {
              const { vehicle } = entry;
              const image = vehicle.images[0]?.url ?? null;
              return (
                <article className={styles.card} id={`vehicule-${vehicle.id}`} key={vehicle.id}>
                  <div className={styles.row}>
                    <div>
                      <span className={styles.eyebrow}>{CATALOG_LABELS[vehicle.catalog_type]}</span>
                      <h2>{vehicle.brand} {vehicle.model}</h2>
                      <p className={styles.muted}>
                        Stock catalogue : <strong>{vehicle.stock_quantity}</strong> · Exemplaires physiques mobilisables : <strong>{entry.allocatableCount}</strong>
                      </p>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.pill}>SHOWROOM · {entry.showroomCount}</span>
                      <span className={styles.pill}>DÉMO · {entry.demoCount}</span>
                    </div>
                  </div>

                  <div className={styles.grid2} style={{ marginTop: 16 }}>
                    <div className={styles.item}>
                      {image ? (
                        <img
                          src={image}
                          alt={`${vehicle.brand} ${vehicle.model}`}
                          style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12 }}
                        />
                      ) : (
                        <p className={styles.muted}>Aucune photo enregistrée.</p>
                      )}
                      <p>Prix catalogue : <strong>{money(vehicle.price)}</strong></p>
                      <p>
                        Répartition actuelle : <strong>{entry.showroomCount}</strong> showroom · <strong>{Math.max(0, entry.allocatableCount - entry.showroomCount)}</strong> stock/arrivage disponible
                      </p>
                    </div>

                    <div className={styles.item}>
                      <span className={styles.eyebrow}>RÉPARTITION SHOWROOM</span>
                      <h3>Showroom et démonstration</h3>
                      <form className={styles.form} action={setShowroomAndDemoQuantitiesV1645}>
                        <input type="hidden" name="vehicle_id" value={vehicle.id} />
                        <label>
                          Exemplaires au showroom
                          <input
                            type="number"
                            name="showroom_quantity"
                            min="0"
                            max={entry.allocatableCount}
                            defaultValue={entry.showroomCount}
                            required
                          />
                        </label>
                        <label>
                          Dont véhicules de démonstration
                          <input
                            type="number"
                            name="demo_quantity"
                            min="0"
                            max={entry.allocatableCount}
                            defaultValue={entry.demoCount}
                            required
                          />
                        </label>
                        <p className={styles.muted}>
                          Exemple : sur 6 exemplaires, mets <strong>2</strong> au showroom et <strong>1</strong> en démonstration. Les 4 autres restent en stock normal.
                        </p>
                        <button className={styles.button}>Appliquer les quantités</button>
                      </form>
                    </div>
                  </div>

                  {entry.showroomUnits.length > 0 && (
                    <section style={{ marginTop: 18 }}>
                      <span className={styles.eyebrow}>EXEMPLAIRES PRÉSENTS AU SHOWROOM</span>
                      <h3>Détail des exemplaires du showroom</h3>
                      <p className={styles.muted}>
                        La quantité de démonstration se règle au-dessus. Ici, tu peux ensuite choisir précisément quel exemplaire est la démo et renseigner son kilométrage, sa valeur de référence et une note.
                      </p>
                      <div className={styles.grid2}>
                        {entry.showroomUnits.map((unit) => (
                          <form className={`${styles.item} ${styles.form}`} action={saveDemoUnitV1643} key={unit.id}>
                            <input type="hidden" name="unit_id" value={unit.id} />
                            <input type="hidden" name="vehicle_id" value={vehicle.id} />
                            <div className={styles.row}>
                              <div>
                                <strong>{unit.unitCode}</strong>
                                <p className={styles.muted}>Emplacement : {unit.location || "Showroom Nostra Motors"}</p>
                              </div>
                              <span className={styles.pill}>{unit.isDemo ? "DÉMONSTRATION" : "EXPOSITION"}</span>
                            </div>
                            <label className={styles.permission}>
                              <input type="checkbox" name="is_demo" defaultChecked={unit.isDemo} />
                              Cet exemplaire est un véhicule de démonstration
                            </label>
                            <label>
                              Kilométrage de cet exemplaire
                              <input type="number" min="0" name="demo_mileage" defaultValue={unit.demoMileage} />
                            </label>
                            <label>
                              Prix neuf / valeur de référence (€)
                              <input name="demo_original_price" inputMode="decimal" defaultValue={unit.demoOriginalPrice ?? ""} placeholder="Optionnel" />
                            </label>
                            <label>
                              Note interne / démonstration
                              <textarea name="demo_note" defaultValue={unit.demoNote} placeholder="Ex. véhicule d’essai, état, particularité…" />
                            </label>
                            <button className={styles.button}>Enregistrer cet exemplaire</button>
                          </form>
                        ))}
                      </div>
                    </section>
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
