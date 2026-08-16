import Link from "next/link";

import styles from "@/components/v163/v163.module.css";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WarrantyPlan = {
  id: number | string;
  name: string;
  description: string | null;
  duration_days: number;
  rate_percent: number;
  deductible: number;
  engine: boolean;
  gearbox: boolean;
  electronics: boolean;
  suspension: boolean;
  bodywork: boolean;
  tyres: boolean;
};

const fallbackPlans: WarrantyPlan[] = [
  {
    id: "care",
    name: "Nostra Care",
    description: "La protection essentielle Nostra Motors pour les principaux organes du véhicule.",
    duration_days: 90,
    rate_percent: 3,
    deductible: 0,
    engine: true,
    gearbox: true,
    electronics: true,
    suspension: true,
    bodywork: false,
    tyres: false,
  },
  {
    id: "care-plus",
    name: "Nostra Care+",
    description: "Une formule étendue avec une couverture plus large et une durée renforcée.",
    duration_days: 180,
    rate_percent: 5,
    deductible: 10000,
    engine: true,
    gearbox: true,
    electronics: true,
    suspension: true,
    bodywork: true,
    tyres: false,
  },
];

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const coverageItems = [
  ["engine", "Moteur"],
  ["gearbox", "Boîte de vitesses"],
  ["electronics", "Électronique"],
  ["suspension", "Suspension"],
  ["bodywork", "Carrosserie"],
  ["tyres", "Pneus"],
] as const;

function normalizePlan(row: any): WarrantyPlan {
  return {
    id: row.id,
    name: String(row.name ?? "Nostra Care"),
    description: row.description ? String(row.description) : null,
    duration_days: Math.max(1, Number(row.duration_days) || 1),
    rate_percent: Math.max(0, Number(row.rate_percent) || 0),
    deductible: Math.max(0, Number(row.deductible) || 0),
    engine: Boolean(row.engine),
    gearbox: Boolean(row.gearbox),
    electronics: Boolean(row.electronics),
    suspension: Boolean(row.suspension),
    bodywork: Boolean(row.bodywork),
    tyres: Boolean(row.tyres),
  };
}

export default async function NostraCarePage() {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("motors_warranty_plans_v163")
    .select(
      "id,name,description,duration_days,rate_percent,deductible,engine,gearbox,electronics,suspension,bodywork,tyres,active",
    )
    .eq("active", true)
    .order("rate_percent", { ascending: true })
    .order("duration_days", { ascending: true });

  const plans: WarrantyPlan[] =
    !error && Array.isArray(data) && data.length > 0
      ? data.map(normalizePlan)
      : fallbackPlans;

  return (
    <main
      className={styles.page}
      style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 18px 72px" }}
    >
      <section className={styles.hero}>
        <p className={styles.eyebrow}>NOSTRA MOTORS · NOSTRA CARE</p>
        <h1>Les contrats Nostra Care</h1>
        <p className={styles.muted}>
          Nostra Care et Nostra Care+ sont les protections proposées par Nostra Motors
          pour les véhicules présents dans ton garage. Le prix de la formule est calculé
          sur le prix réellement payé pour le véhicule, puis le contrat devient actif au
          moment de son paiement.
        </p>
        <div className={styles.row}>
          <Link className={styles.button} href="/profil/garanties">
            Souscrire un contrat
          </Link>
          <Link className={styles.buttonAlt} href="/profil/garage">
            Ouvrir mon garage
          </Link>
        </div>
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>PRINCIPE</p>
        <h2>Comment fonctionne un contrat ?</h2>
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <span>1 · Formule</span>
            <strong>Care ou Care+</strong>
            <p className={styles.mini}>Choisis d’abord la protection qui t’intéresse sur cette page.</p>
          </div>
          <div className={styles.kpi}>
            <span>2 · Véhicule</span>
            <strong>Mon garage</strong>
            <p className={styles.mini}>Avant le panier, sélectionne précisément le véhicule à couvrir parmi tes véhicules.</p>
          </div>
          <div className={styles.kpi}>
            <span>3 · Tarif</span>
            <strong>% du prix payé</strong>
            <p className={styles.mini}>Le montant est calculé automatiquement à partir du prix d’achat enregistré.</p>
          </div>
          <div className={styles.kpi}>
            <span>4 · Activation</span>
            <strong>Au paiement</strong>
            <p className={styles.mini}>La date de début correspond au paiement et la date de fin dépend de la durée de la formule.</p>
          </div>
        </div>
      </section>

      <section className={styles.grid}>
        {plans.map((plan) => (
          <article className={`${styles.card} ${styles.highlight}`} key={plan.id}>
            <p className={styles.eyebrow}>{plan.duration_days} JOURS</p>
            <h2>{plan.name}</h2>
            <p className={styles.muted}>
              {plan.description || "Protection Nostra Motors liée au véhicule sélectionné."}
            </p>

            <div className={styles.kpis}>
              <div className={styles.kpi}>
                <span>Tarif</span>
                <strong>{plan.rate_percent} %</strong>
                <small>du prix réellement payé</small>
              </div>
              <div className={styles.kpi}>
                <span>Durée</span>
                <strong>{plan.duration_days}</strong>
                <small>jours après activation</small>
              </div>
              <div className={styles.kpi}>
                <span>Franchise</span>
                <strong>{money(plan.deductible)}</strong>
                <small>selon la formule active</small>
              </div>
            </div>

            <div className={styles.divider} />
            <h3>Couverture de la formule</h3>
            <div className={styles.stack}>
              {coverageItems.map(([key, label]) => (
                <div className={styles.row} key={key}>
                  <span>{label}</span>
                  <span className={styles.pill}>
                    {plan[key] ? "Inclus" : "Non inclus"}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.divider} />
            <div className={styles.notice}>
              <strong>Le prix exact dépend de ton véhicule.</strong>
              <p className={styles.mini}>
                Le véhicule est choisi avant l’ajout au panier. Le site récupère son prix
                d’achat dans Profil → Mon garage et calcule automatiquement le montant.
              </p>
            </div>
            <Link
              className={styles.button}
              href={/^\d+$/.test(String(plan.id)) ? `/profil/garanties?plan=${encodeURIComponent(String(plan.id))}` : "/profil/garanties"}
            >
              Souscrire / calculer mon prix
            </Link>
          </article>
        ))}
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <p className={styles.eyebrow}>SOUSCRIPTION</p>
          <h2>Du garage jusqu’au contrat actif</h2>
          <div className={styles.stack}>
            <div className={styles.notice}>
              <strong>1. Choisis Nostra Care ou Nostra Care+.</strong>
              <p className={styles.mini}>Depuis cette page, lance la souscription de la formule souhaitée.</p>
            </div>
            <div className={styles.notice}>
              <strong>2. Choisis le véhicule dans ton garage.</strong>
              <p className={styles.mini}>Aucun véhicule n’est choisi automatiquement : tu sélectionnes celui qui doit recevoir le contrat.</p>
            </div>
            <div className={styles.notice}>
              <strong>3. Le site calcule le prix puis l’envoie au panier.</strong>
              <p className={styles.mini}>Le montant est calculé avec le prix réellement payé pour le véhicule sélectionné.</p>
            </div>
            <div className={styles.notice}>
              <strong>4. Après paiement, le contrat apparaît sur ce véhicule.</strong>
              <p className={styles.mini}>La garantie s’active et devient visible directement dans Profil → Mon garage sur la fiche correspondante.</p>
            </div>
          </div>
        </article>

        <article className={styles.card}>
          <p className={styles.eyebrow}>À SAVOIR</p>
          <h2>Règles importantes</h2>
          <div className={styles.stack}>
            <div>
              <strong>Une protection à la fois</strong>
              <p className={styles.mini}>
                Un véhicule ne peut pas avoir simultanément une autre garantie en attente
                de paiement ou une garantie encore active.
              </p>
            </div>
            <div className={styles.divider} />
            <div>
              <strong>La couverture dépend de la formule</strong>
              <p className={styles.mini}>
                Un élément indiqué « Non inclus » ne fait pas partie de la protection du contrat choisi.
              </p>
            </div>
            <div className={styles.divider} />
            <div>
              <strong>Le contrat a une durée définie</strong>
              <p className={styles.mini}>
                Une fois sa date de fin dépassée, le contrat n’est plus actif. Nostra Motors peut gérer
                la date de fin depuis l’administration lorsque cela est nécessaire.
              </p>
            </div>
            <div className={styles.divider} />
            <div>
              <strong>La formule souscrite est enregistrée</strong>
              <p className={styles.mini}>
                Les informations du contrat conservent la formule, le taux, le prix de référence,
                la durée et les éléments couverts au moment de la souscription.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>PRISE EN CHARGE</p>
        <h2>En cas de problème avec le véhicule</h2>
        <p className={styles.muted}>
          Consulte d’abord ton contrat dans « Mes garanties Nostra » pour vérifier qu’il est
          encore actif et que l’élément concerné fait partie de ta couverture. La prise en charge
          est ensuite traitée par Nostra Motors dans le cadre du suivi atelier / après-vente.
        </p>
        <div className={styles.row}>
          <Link className={styles.button} href="/motors/atelier">
            Ouvrir l’Atelier Nostra
          </Link>
          <Link className={styles.buttonAlt} href="/profil/garanties">
            Consulter mes contrats
          </Link>
        </div>
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>FAQ</p>
        <h2>Questions fréquentes</h2>
        <div className={styles.stack}>
          <details className={styles.details}>
            <summary>Quand ma garantie commence-t-elle ?</summary>
            <p className={styles.muted}>Au moment où le paiement de la garantie est enregistré.</p>
          </details>
          <div className={styles.divider} />
          <details className={styles.details}>
            <summary>Comment est calculé le prix ?</summary>
            <p className={styles.muted}>
              Le taux de la formule est appliqué au prix réellement payé pour le véhicule et enregistré dans ton garage.
            </p>
          </details>
          <div className={styles.divider} />
          <details className={styles.details}>
            <summary>Puis-je souscrire si une garantie est déjà active ?</summary>
            <p className={styles.muted}>
              Non. Le système bloque une nouvelle souscription tant qu’une garantie active ou une garantie en attente existe déjà pour ce véhicule.
            </p>
          </details>
          <div className={styles.divider} />
          <details className={styles.details}>
            <summary>Où retrouver mon contrat ?</summary>
            <p className={styles.muted}>
              Dans Profil → Mon garage, directement sur le véhicule couvert, et dans la section « Mes garanties Nostra » avec tous les détails du contrat.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}
