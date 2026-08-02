import Link from "next/link";

import { getVehicleFinancingSettings } from "@/lib/vehicle-financing/data";

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

function FinancingExample({
  termCount,
  feePercent,
  vehiclePrice,
  downPaymentPercent,
}: {
  termCount: 3 | 4;
  feePercent: number;
  vehiclePrice: number;
  downPaymentPercent: number;
}) {
  const downPayment = Math.round(vehiclePrice * (downPaymentPercent / 100));
  const principal = vehiclePrice - downPayment;
  const fees = Math.round(principal * (feePercent / 100));
  const financedTotal = principal + fees;
  const installment = financedTotal / termCount;

  return (
    <article className={styles.offer}>
      <header>
        <span>{termCount}×</span>
        <div>
          <p>PAIEMENT EN {termCount} FOIS</p>
          <h3>{feePercent} % de frais</h3>
        </div>
      </header>

      <dl>
        <div>
          <dt>Apport de {downPaymentPercent} %</dt>
          <dd>{money(downPayment)}</dd>
        </div>
        <div>
          <dt>Montant restant</dt>
          <dd>{money(principal)}</dd>
        </div>
        <div>
          <dt>Frais automatiques</dt>
          <dd>{money(fees)}</dd>
        </div>
        <div className={styles.highlightLine}>
          <dt>{termCount} échéances d’environ</dt>
          <dd>{money(installment)}</dd>
        </div>
      </dl>
    </article>
  );
}

const steps = [
  {
    number: "01",
    title: "Choisis ton véhicule",
    description:
      "Ouvre sa fiche dans le catalogue. Le financement apparaît uniquement si son prix dépasse le minimum demandé.",
  },
  {
    number: "02",
    title: "Dépose ton dossier",
    description:
      "Sélectionne le paiement en 3× ou 4× et ajoute, si tu le souhaites, un message destiné à la Direction.",
  },
  {
    number: "03",
    title: "Décision du Gérant",
    description:
      "La Direction étudie la demande, puis accepte ou refuse le financement. La décision reste visible dans ton espace personnel.",
  },
  {
    number: "04",
    title: "Règle l’apport",
    description:
      "Après acceptation, le véhicule est réservé et l’apport obligatoire est ajouté à ton panier. Aucun paiement n’est demandé avant l’accord.",
  },
  {
    number: "05",
    title: "Paie les échéances",
    description:
      "Une fois l’apport payé, l’échéancier est créé. Chaque paiement est suivi depuis ton espace personnel jusqu’au règlement complet.",
  },
];

export default async function MotorsFinancingPage() {
  const settings = await getVehicleFinancingSettings();
  const examplePrice = Math.max(1_000_000, settings.minimumVehiclePrice + 500_000);
  const availableOffers = [
    settings.threeTimesEnabled && {
      termCount: 3 as const,
      feePercent: settings.threeTimesFeePercent,
    },
    settings.fourTimesEnabled && {
      termCount: 4 as const,
      feePercent: settings.fourTimesFeePercent,
    },
  ].filter(Boolean) as Array<{ termCount: 3 | 4; feePercent: number }>;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>NOSTRA MOTORS · FINANCEMENT</p>
          <h1>Ton véhicule, avec un paiement en 3× ou 4×</h1>
          <p className={styles.intro}>
            Dépose une demande de financement pour un véhicule éligible, sans
            payer au moment du dépôt. La Direction étudie ton dossier avant de
            réserver le véhicule et de débloquer l’apport.
          </p>

          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/motors/catalogue">
              Voir les véhicules
            </Link>
            <Link className={styles.secondaryAction} href="/profil/financements">
              Suivre mes dossiers
            </Link>
          </div>
        </div>

        <aside className={styles.statusCard}>
          <span className={settings.enabled ? styles.statusOpen : styles.statusClosed}>
            {settings.enabled ? "Dossiers ouverts" : "Dossiers fermés"}
          </span>
          <div>
            <small>VÉHICULE ÉLIGIBLE</small>
            <strong>Plus de {money(settings.minimumVehiclePrice)}</strong>
          </div>
          <div>
            <small>APPORT OBLIGATOIRE</small>
            <strong>{settings.downPaymentPercent} % du prix</strong>
          </div>
          <div>
            <small>ENTRE DEUX ÉCHÉANCES</small>
            <strong>{settings.installmentIntervalDays} jours</strong>
          </div>
        </aside>
      </section>

      {!settings.configured && (
        <div className={styles.notice}>
          Le module de financement est en cours de configuration. Les demandes
          ne peuvent pas encore être déposées.
        </div>
      )}

      <section className={styles.rules} aria-labelledby="conditions-title">
        <header className={styles.sectionHeading}>
          <p className={styles.eyebrow}>CONDITIONS PRINCIPALES</p>
          <h2 id="conditions-title">Ce qu’il faut savoir avant la demande</h2>
        </header>

        <div className={styles.ruleGrid}>
          <article>
            <span>01</span>
            <h3>Prix strictement supérieur</h3>
            <p>
              Le véhicule doit coûter plus de {money(settings.minimumVehiclePrice)}.
              Un véhicule affiché exactement à ce prix n’est pas éligible.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Apport fixe de {settings.downPaymentPercent} %</h3>
            <p>
              L’apport est obligatoire et calculé sur le prix du véhicule. Il
              n’est demandé qu’après l’acceptation du dossier.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Dossier personnel</h3>
            <p>
              La demande est enregistrée dans ton espace et son état peut être
              suivi à tout moment depuis la rubrique « Mes financements ».
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>Décision non automatique</h3>
            <p>
              Chaque demande est étudiée. La Direction peut l’accepter ou la
              refuser et le motif de la décision reste visible dans ton suivi.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.simulation} aria-labelledby="simulation-title">
        <header className={styles.sectionHeading}>
          <p className={styles.eyebrow}>EXEMPLE DE CALCUL</p>
          <h2 id="simulation-title">Pour un véhicule à {money(examplePrice)}</h2>
          <p>
            Les frais s’appliquent uniquement au montant restant après l’apport.
            Les montants ci-dessous utilisent les taux actuellement enregistrés.
          </p>
        </header>

        {availableOffers.length > 0 ? (
          <div className={styles.offers}>
            {availableOffers.map((offer) => (
              <FinancingExample
                key={offer.termCount}
                {...offer}
                vehiclePrice={examplePrice}
                downPaymentPercent={settings.downPaymentPercent}
              />
            ))}
          </div>
        ) : (
          <div className={styles.notice}>
            Les formules 3× et 4× sont actuellement désactivées par la Direction.
          </div>
        )}
      </section>

      <section className={styles.process} aria-labelledby="steps-title">
        <header className={styles.sectionHeading}>
          <p className={styles.eyebrow}>PARCOURS DU DOSSIER</p>
          <h2 id="steps-title">De la demande à la commande finale</h2>
        </header>

        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.footerCta}>
        <div>
          <p className={styles.eyebrow}>PRÊT À DÉPOSER TON DOSSIER ?</p>
          <h2>Choisis un véhicule éligible dans le catalogue</h2>
          <p>
            L’option de financement apparaîtra directement au moment de choisir
            ton mode d’achat.
          </p>
        </div>
        <Link className={styles.primaryAction} href="/motors/catalogue">
          Ouvrir le catalogue
        </Link>
      </section>
    </main>
  );
}
