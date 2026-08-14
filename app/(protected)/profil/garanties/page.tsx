import Link from "next/link";
import { redirect } from "next/navigation";

import { subscribeWarrantyV163 } from "@/app/actions/v163";
import styles from "@/components/v163/v163.module.css";
import { createClient } from "@/lib/supabase/server";
import { getMyWarrantiesV163 } from "@/lib/v163/data";

export const dynamic = "force-dynamic";

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("fr-FR") : "—";

const title = (vehicle: any) =>
  `${vehicle.brand ?? ""} ${vehicle.model ?? ""}`.trim() ||
  vehicle.vehicle_name ||
  `VL #${vehicle.id}`;

const warrantyPrice = (vehiclePrice: unknown, ratePercent: unknown) =>
  Math.round(
    Math.max(0, Number(vehiclePrice) || 0) *
      (Math.max(0, Number(ratePercent) || 0) / 100),
  );

export default async function MyWarranties({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const params = await searchParams;
  const all = await getMyWarrantiesV163(userData.user.id);
  const selectedId = Number(params.vehicle) || Number(all.vehicles[0]?.id) || 0;
  const vehicle =
    all.vehicles.find((row: any) => Number(row.id) === selectedId) ?? null;
  const contracts = all.warranties.filter(
    (row: any) => !vehicle || Number(row.customer_vehicle_id) === Number(vehicle.id),
  );
  const active =
    contracts.find(
      (row: any) =>
        row.status === "active" && new Date(row.ends_at).getTime() > Date.now(),
    ) ?? null;
  const pending = contracts.find((row: any) => row.status === "pending_payment") ?? null;
  const referencePrice = Math.max(0, Number(vehicle?.purchase_price) || 0);

  return (
    <main
      className={styles.page}
      style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 18px 70px" }}
    >
      <section className={styles.hero}>
        <p className={styles.eyebrow}>NOSTRA CARE</p>
        <h1>Garanties de mes véhicules</h1>
        <p className={styles.muted}>
          Le tarif est calculé automatiquement sur le prix réellement payé pour ton
          véhicule. Une formule ajoutée est ensuite payée depuis le panier Nostra.
        </p>
        <div className={styles.row}>
          <Link className={styles.buttonAlt} href="/profil">
            ← Profil
          </Link>
          <Link className={styles.buttonAlt} href="/profil/garage">
            Mon garage
          </Link>
        </div>
      </section>

      {params.error && (
        <div className={styles.error}>
          Impossible d’ajouter la garantie : {decodeURIComponent(params.error)}.
        </div>
      )}

      <section className={styles.card}>
        <h2>Choisir un véhicule</h2>
        <div className={styles.grid}>
          {all.vehicles.map((row: any) => (
            <Link
              key={row.id}
              href={`/profil/garanties?vehicle=${row.id}`}
              className={`${styles.card} ${
                Number(row.id) === selectedId ? styles.highlight : ""
              }`}
            >
              <strong>{title(row)}</strong>
              <span className={styles.mini}>
                Prix payé : {money(row.purchase_price)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {vehicle && (
        <>
          <section className={styles.card}>
            <div className={styles.row}>
              <div>
                <p className={styles.eyebrow}>VÉHICULE SÉLECTIONNÉ</p>
                <h2>{title(vehicle)}</h2>
              </div>
              <span className={styles.pill}>
                Base de calcul : {money(referencePrice)}
              </span>
            </div>
            {active && (
              <div className={styles.success}>
                Garantie active jusqu’au {date(active.ends_at)}.
              </div>
            )}
            {pending && (
              <div className={styles.success}>
                {pending.plan_name} est déjà dans ton panier pour {money(pending.amount)}.
              </div>
            )}
          </section>

          <section className={styles.grid}>
            {all.warrantyPlans.map((plan: any) => {
              const price = warrantyPrice(referencePrice, plan.rate_percent);
              return (
                <form
                  action={subscribeWarrantyV163}
                  className={`${styles.card} ${styles.highlight}`}
                  key={plan.id}
                >
                  <input
                    type="hidden"
                    name="customer_vehicle_id"
                    value={vehicle.id}
                  />
                  <input type="hidden" name="plan_id" value={plan.id} />
                  <p className={styles.eyebrow}>{plan.duration_days} JOURS</p>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className={styles.coverage}>
                    {plan.engine && <span>Moteur</span>}
                    {plan.gearbox && <span>Boîte</span>}
                    {plan.electronics && <span>Électronique</span>}
                    {plan.suspension && <span>Suspension</span>}
                    {plan.bodywork && <span>Carrosserie</span>}
                    {plan.tyres && <span>Pneus</span>}
                  </div>
                  <div className={styles.row}>
                    <strong>{money(price)}</strong>
                    <span className={styles.pill}>
                      {Number(plan.rate_percent)} % du prix payé
                    </span>
                    <span className={styles.pill}>
                      Franchise {money(plan.deductible)}
                    </span>
                  </div>
                  <button
                    className={styles.button}
                    disabled={Boolean(active || pending || referencePrice <= 0)}
                  >
                    {pending ? "Déjà dans le panier" : "Ajouter au panier"}
                  </button>
                  {referencePrice <= 0 && (
                    <p className={styles.mini}>
                      Le prix d’achat du véhicule doit être renseigné pour calculer la
                      garantie.
                    </p>
                  )}
                </form>
              );
            })}
          </section>

          <section className={styles.card}>
            <div className={styles.row}>
              <h2>Contrats</h2>
              {active && (
                <span className={styles.pill}>
                  Garantie active jusqu’au {date(active.ends_at)}
                </span>
              )}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Formule</th>
                    <th>Taux</th>
                    <th>Prix</th>
                    <th>Période</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((row: any) => (
                    <tr key={row.id}>
                      <td>{row.contract_number}</td>
                      <td>
                        {row.plan_name}
                        <div className={styles.mini}>{row.duration_days} jours</div>
                      </td>
                      <td>{Number(row.rate_percent ?? 0)} %</td>
                      <td>{money(row.amount)}</td>
                      <td>
                        {date(row.starts_at)} → {date(row.ends_at)}
                      </td>
                      <td>
                        <span className={styles.pill}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
