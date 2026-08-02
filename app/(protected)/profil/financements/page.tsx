import Link from "next/link";
import { redirect } from "next/navigation";

import { checkoutVehicleFinancingPayment } from "@/app/actions/vehicle-financing";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnVehicleFinancingApplications,
  type VehicleFinancingApplication,
} from "@/lib/vehicle-financing/data";

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

function date(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

const labels: Record<string, string> = {
  pending_review: "En attente de décision",
  deposit_due: "Accepté — apport à payer",
  active: "Financement actif",
  completed: "Payé intégralement",
  rejected: "Dossier refusé",
  cancelled: "Dossier annulé",
};

export default async function ProfileFinancingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const [applications, params] = await Promise.all([
    getOwnVehicleFinancingApplications(data.user.id),
    searchParams,
  ]);

  return (
    <>
      <ProfileSectionHeader
        eyebrow="NOSTRA MOTORS"
        title="Mes financements"
        description="Suis l’étude de ton dossier, règle l’apport obligatoire de 30 % et consulte chaque échéance du paiement en 3× ou 4×."
      />

      {params.submitted && (
        <div className={styles.success}>
          Le dossier <strong>{params.submitted}</strong> a été envoyé au Gérant.
          Aucun paiement n’est demandé avant sa décision.
        </div>
      )}
      {params.paid && (
        <div className={styles.success}>
          {params.paid === "deposit"
            ? "L’apport de 30 % a été payé. Le financement est maintenant actif et la première échéance est disponible."
            : params.paid === "final_installment"
              ? "Dernière échéance payée. Le véhicule est intégralement réglé et la commande finale a été créée."
              : "L’échéance a été payée. La suivante a été préparée automatiquement."}
        </div>
      )}
      {params.error && (
        <div className={styles.error}>
          {params.error === "setup"
            ? "Le module de financement doit être activé avec le SQL V125."
            : params.error === "payment-missing"
              ? "La ligne de paiement n’est plus dans ton panier. Recharge la page."
              : "Le paiement n’a pas pu être enregistré. Recharge la page ou contacte Nostra Motors."}
        </div>
      )}

      <section className={styles.page}>
        <header className={styles.heading}>
          <div><p>DOSSIERS</p><h2>Financements enregistrés</h2></div>
          <span>{applications.length}</span>
        </header>
        <div className={styles.list}>
          {applications.length === 0 && (
            <div className={styles.empty}>
              <p>Aucun dossier de financement.</p>
              <Link href="/motors/catalogue">Voir les véhicules disponibles</Link>
            </div>
          )}
          {applications.map((application) => (
            <FinancingCard key={application.id} application={application} />
          ))}
        </div>
      </section>
    </>
  );
}

function FinancingCard({ application }: { application: VehicleFinancingApplication }) {
  const pendingInstallment = application.installments.find(
    (installment) => installment.status === "pending",
  );
  const paidCount = application.installments.filter(
    (installment) => installment.status === "paid",
  ).length;
  const initialPayment = application.down_payment_amount + application.delivery_fee;
  const payable =
    application.status === "deposit_due" ||
    (application.status === "active" && Boolean(pendingInstallment));

  return (
    <article className={styles.card}>
      <header>
        <div>
          <p>{application.application_number}</p>
          <h3>{application.vehicle_name}</h3>
          <span>Demande envoyée le {date(application.created_at)}</span>
        </div>
        <span className={`${styles.status} ${styles[`status_${application.status}`] ?? ""}`}>
          {labels[application.status] ?? application.status}
        </span>
      </header>

      <div className={styles.summary}>
        <div><span>Prix du véhicule</span><strong>{money(application.vehicle_price)}</strong></div>
        <div><span>Formule choisie</span><strong>{application.term_count} échéances</strong></div>
        <div><span>Apport obligatoire (30 %)</span><strong>{money(application.down_payment_amount)}</strong></div>
        <div><span>Frais automatiques ({application.fee_percent} %)</span><strong>{money(application.fee_amount)}</strong></div>
        <div><span>Total des échéances</span><strong>{money(application.financed_total)}</strong></div>
        <div><span>Progression</span><strong>{paidCount} / {application.term_count} payée(s)</strong></div>
      </div>

      {application.status === "pending_review" && (
        <div className={styles.waiting}>
          Le Gérant étudie actuellement le dossier et le solde bancaire lié au
          compte en jeu. L’apport ne sera demandé qu’après acceptation.
        </div>
      )}

      {application.review_note && (
        <div className={styles.note}>
          <span>MESSAGE DE LA DIRECTION</span>
          <p>{application.review_note}</p>
        </div>
      )}

      {application.installments.length > 0 && (
        <section className={styles.schedule}>
          <header><h4>Échéancier</h4><span>{application.term_count} paiements</span></header>
          {application.installments.map((installment) => (
            <div className={installment.status === "paid" ? styles.paid : ""} key={installment.id}>
              <span className={styles.number}>{installment.status === "paid" ? "✓" : installment.installment_number}</span>
              <div><strong>Échéance {installment.installment_number}</strong><small>{installment.status === "paid" ? `Payée le ${date(installment.paid_at)}` : `À régler avant le ${date(installment.due_at)}`}</small></div>
              <strong>{money(installment.amount)}</strong>
            </div>
          ))}
        </section>
      )}

      {payable && (
        <form action={checkoutVehicleFinancingPayment} className={styles.payment}>
          <input type="hidden" name="application_id" value={application.id} />
          <div>
            <span>{application.status === "deposit_due" ? "Apport à payer maintenant" : `Échéance ${pendingInstallment?.installment_number} à payer`}</span>
            <strong>{money(application.status === "deposit_due" ? initialPayment : pendingInstallment?.amount ?? 0)}</strong>
            {application.status === "deposit_due" && application.delivery_fee > 0 && <small>30 % du véhicule + {money(application.delivery_fee)} de livraison</small>}
          </div>
          <button type="submit">{application.status === "deposit_due" ? "Payer mon apport de 30 %" : "Payer cette échéance"}</button>
        </form>
      )}

      {application.final_order_number && (
        <p className={styles.order}>Commande finale créée : <strong>{application.final_order_number}</strong></p>
      )}
    </article>
  );
}
