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
  const selectedId = Number(params.vehicle) || 0;
  const requestedPlanId = String(params.plan ?? "").trim();
  const vehicle =
    selectedId > 0
      ? all.vehicles.find((row: any) => Number(row.id) === selectedId) ?? null
      : null;
  const contracts = all.warranties.filter(
    (row: any) => vehicle && Number(row.customer_vehicle_id) === Number(vehicle.id),
  );
  const active =
    contracts.find(
      (row: any) =>
        row.status === "active" && new Date(row.ends_at).getTime() > Date.now(),
    ) ?? null;
  const pending =
    contracts.find((row: any) => row.status === "pending_payment") ?? null;
  const referencePrice = Math.max(0, Number(vehicle?.purchase_price) || 0);
  const sortedPlans = [...all.warrantyPlans].sort((a: any, b: any) => {
    const aSelected = String(a.id) === requestedPlanId ? 0 : 1;
    const bSelected = String(b.id) === requestedPlanId ? 0 : 1;
    if (aSelected !== bSelected) return aSelected - bSelected;
    return Number(a.rate_percent ?? 0) - Number(b.rate_percent ?? 0);
  });

  return (
    <main
      className={styles.page}
      style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 18px 70px" }}
    >
      <section className={styles.hero}>
        <p className={styles.eyebrow}>NOSTRA CARE</p>
        <h1>Souscrire un contrat pour un véhicule</h1>
        <p className={styles.muted}>
          Avant qu’un contrat arrive dans ton panier, tu dois choisir le véhicule à
          couvrir parmi ceux de Profil → Mon garage. Le site calcule ensuite le prix
          automatiquement selon le prix réellement payé pour ce véhicule.
        </p>
        <div className={styles.row}>
          <Link className={styles.buttonAlt} href="/profil">
            ← Profil
          </Link>
          <Link className={styles.buttonAlt} href="/profil/garage">
            Mon garage
          </Link>
          <Link className={styles.buttonAlt} href="/motors/nostra-care">
            Comprendre Nostra Care
          </Link>
        </div>
      </section>

      {params.error && (
        <div className={styles.error}>
          Impossible d’ajouter la garantie : {decodeURIComponent(params.error)}.
        </div>
      )}

      <section className={`${styles.card} ${!vehicle ? styles.highlight : ""}`}>
        <p className={styles.eyebrow}>ÉTAPE 1</p>
        <h2>Choisir le véhicule à couvrir</h2>
        <p className={styles.muted}>
          Seuls les véhicules présents dans ton garage Nostra Motors peuvent recevoir
          un contrat Nostra Care.
        </p>

        {all.vehicles.length === 0 ? (
          <div className={styles.notice}>
            <strong>Aucun véhicule disponible dans ton garage.</strong>
            <p className={styles.mini}>
              Un véhicule doit d’abord être enregistré dans Profil → Mon garage avant
              de pouvoir souscrire une garantie.
            </p>
            <Link className={styles.buttonAlt} href="/motors/catalogue">
              Ouvrir le catalogue
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {all.vehicles.map((row: any) => {
              const href = requestedPlanId
                ? `/profil/garanties?vehicle=${row.id}&plan=${encodeURIComponent(requestedPlanId)}`
                : `/profil/garanties?vehicle=${row.id}`;
              const selected = Number(row.id) === selectedId;
              return (
                <Link
                  key={row.id}
                  href={href}
                  className={`${styles.card} ${selected ? styles.highlight : ""}`}
                >
                  <p className={styles.eyebrow}>{selected ? "VÉHICULE CHOISI" : "MON GARAGE"}</p>
                  <strong>{title(row)}</strong>
                  <span className={styles.mini}>Commande {row.order_number || "—"}</span>
                  <span className={styles.mini}>
                    Prix payé : {money(row.purchase_price)}
                  </span>
                  <span className={styles.pill}>
                    {selected ? "Sélectionné" : "Choisir ce véhicule"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {!vehicle && all.vehicles.length > 0 && (
        <section className={styles.notice}>
          <strong>Aucun contrat n’est encore ajouté au panier.</strong>
          <p className={styles.mini}>
            Choisis d’abord le véhicule concerné. Son prix d’achat servira de base au
            calcul de Nostra Care ou Nostra Care+.
          </p>
        </section>
      )}

      {vehicle && (
        <>
          <section className={styles.card}>
            <div className={styles.row}>
              <div>
                <p className={styles.eyebrow}>VÉHICULE SÉLECTIONNÉ</p>
                <h2>{title(vehicle)}</h2>
                <p className={styles.mini}>
                  Commande {vehicle.order_number || "—"} · véhicule du garage #{vehicle.id}
                </p>
              </div>
              <span className={styles.pill}>
                Base de calcul : {money(referencePrice)}
              </span>
            </div>
            <div className={styles.row}>
              <Link
                className={styles.buttonAlt}
                href={requestedPlanId ? `/profil/garanties?plan=${encodeURIComponent(requestedPlanId)}` : "/profil/garanties"}
              >
                Changer de véhicule
              </Link>
              <Link className={styles.buttonAlt} href={`/profil/garage/${vehicle.id}`}>
                Voir sa fiche garage
              </Link>
            </div>
            {active && (
              <div className={styles.success}>
                {active.plan_name} est déjà actif sur ce véhicule jusqu’au {date(active.ends_at)}.
              </div>
            )}
            {pending && (
              <div className={styles.success}>
                {pending.plan_name} est déjà dans ton panier pour {money(pending.amount)}.
              </div>
            )}
          </section>

          <section className={styles.card}>
            <p className={styles.eyebrow}>ÉTAPE 2</p>
            <h2>Confirmer la formule et le prix</h2>
            <p className={styles.muted}>
              Le tarif affiché ci-dessous est calculé uniquement pour {title(vehicle)}.
              Le contrat ne sera créé pour aucun autre véhicule.
            </p>
          </section>

          <section className={styles.grid}>
            {sortedPlans.map((plan: any) => {
              const price = warrantyPrice(referencePrice, plan.rate_percent);
              const selectedPlan = String(plan.id) === requestedPlanId;
              return (
                <form
                  action={subscribeWarrantyV163}
                  className={`${styles.card} ${selectedPlan ? styles.highlight : ""}`}
                  key={plan.id}
                >
                  <input
                    type="hidden"
                    name="customer_vehicle_id"
                    value={vehicle.id}
                  />
                  <input type="hidden" name="plan_id" value={plan.id} />
                  <p className={styles.eyebrow}>
                    {selectedPlan ? "FORMULE CHOISIE · " : ""}{plan.duration_days} JOURS
                  </p>
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
                  <div className={styles.notice}>
                    <strong>Contrat lié à : {title(vehicle)}</strong>
                    <p className={styles.mini}>
                      Une fois payé, ce contrat apparaîtra automatiquement sur la fiche
                      de ce véhicule dans Profil → Mon garage.
                    </p>
                  </div>
                  <button
                    className={styles.button}
                    disabled={Boolean(active || pending || referencePrice <= 0)}
                  >
                    {pending ? "Déjà dans le panier" : "Ajouter ce contrat au panier"}
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
              <h2>Contrats de ce véhicule</h2>
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
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Aucun contrat enregistré pour ce véhicule.</td>
                    </tr>
                  ) : (
                    contracts.map((row: any) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
