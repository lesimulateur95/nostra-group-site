import { redirect } from "next/navigation";

import {
  reviewVehicleFinancingApplication,
  updateVehicleFinancingSettings,
} from "@/app/actions/vehicle-financing";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeleteFinancingApplicationButton } from "@/components/motors/delete-financing-application-button";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getCitizenBankInformation,
  type CitizenBankInformation,
} from "@/lib/game-bank/data";
import { createClient } from "@/lib/supabase/server";
import {
  getVehicleFinancingApplications,
  getVehicleFinancingSettings,
  type VehicleFinancingApplication,
} from "@/lib/vehicle-financing/data";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number | null): string {
  if (value === null) return "—";
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function date(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

const statusLabels: Record<string, string> = {
  pending_review: "Dossier à examiner",
  deposit_due: "Accepté — apport à payer",
  active: "Financement actif",
  completed: "Payé intégralement",
  rejected: "Refusé",
  cancelled: "Annulé",
};

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function VehicleFinancingDashboardPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const [settings, applications, params] = await Promise.all([
    getVehicleFinancingSettings(),
    getVehicleFinancingApplications(),
    searchParams,
  ]);
  const bankingByApplication = new Map<number, CitizenBankInformation>();
  await Promise.all(
    applications
      .filter((application) => application.status === "pending_review")
      .map(async (application) => {
      bankingByApplication.set(
        application.id,
        await getCitizenBankInformation(application.steam_id),
      );
      }),
  );

  const pending = applications.filter(
    (application) => application.status === "pending_review",
  );
  const current = applications.filter((application) =>
    ["deposit_due", "active"].includes(application.status),
  );
  const archived = applications.filter((application) =>
    ["completed", "rejected", "cancelled"].includes(application.status),
  );

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>DIRECTION · NOSTRA MOTORS</p>
            <h1>Financements 3× / 4×</h1>
            <p>
              Étudie les dossiers des véhicules de plus de 500 000 €, vérifie
              le solde bancaire actuel du citoyen et accepte ou refuse sa
              demande.
            </p>
          </div>
          <div className={styles.heroStats}>
            <span><strong>{pending.length}</strong> à examiner</span>
            <span><strong>{current.length}</strong> en cours</span>
          </div>
        </section>

        {params.saved && <div className={styles.success}>Les réglages du financement ont été enregistrés.</div>}
        {params.approved && <div className={styles.success}>Le dossier a été accepté. L’apport obligatoire est maintenant disponible dans le panier du citoyen.</div>}
        {params.rejected && <div className={styles.success}>Le dossier a été refusé et le citoyen verra le motif.</div>}
        {params.deleted && <div className={styles.success}>Le dossier de financement a été supprimé définitivement.</div>}
        {params.error && <div className={styles.error}>{params.error === "settings" ? "Vérifie les taux et le délai entre les échéances." : params.error === "invalid" ? "Un motif est obligatoire pour refuser le dossier." : params.error === "stock" ? "Le véhicule n’est plus disponible en stock." : params.error === "setup" ? "Exécute d’abord le SQL V125 du financement." : params.error === "delete-setup" ? "Exécute le SQL V135 pour activer la suppression des dossiers." : params.error === "delete-missing" ? "Ce dossier a déjà été supprimé ou n’existe plus." : params.error === "delete-invalid" ? "Le dossier sélectionné est invalide." : params.error === "delete" ? "Le dossier n’a pas pu être supprimé." : "Le dossier n’a pas pu être traité."}</div>}

        {!settings.configured ? (
          <section className={styles.empty}>
            Le module doit être activé avec le SQL V125 avant de recevoir des
            dossiers.
          </section>
        ) : (
          <>
            <section className={styles.settingsPanel}>
              <header>
                <div>
                  <p className={styles.eyebrow}>RÈGLES AUTOMATIQUES</p>
                  <h2>Paramètres du financement</h2>
                </div>
                <span className={settings.enabled ? styles.open : styles.closed}>
                  {settings.enabled ? "Dossiers ouverts" : "Dossiers fermés"}
                </span>
              </header>
              <div className={styles.fixedRules}>
                <div><span>Prix minimum</span><strong>Plus de {money(settings.minimumVehiclePrice)}</strong></div>
                <div><span>Apport obligatoire</span><strong>{settings.downPaymentPercent} % du véhicule</strong></div>
              </div>
              <form action={updateVehicleFinancingSettings} className={styles.settingsForm}>
                <label><span>Ouverture des dossiers</span><select name="enabled" defaultValue={settings.enabled ? "true" : "false"}><option value="true">Ouverts</option><option value="false">Fermés</option></select></label>
                <label><span>Paiement en 3 fois</span><select name="three_times_enabled" defaultValue={settings.threeTimesEnabled ? "true" : "false"}><option value="true">Disponible</option><option value="false">Désactivé</option></select></label>
                <label><span>Frais automatiques du 3×</span><input name="three_times_fee_percent" type="number" min="0" max="50" step="0.1" defaultValue={settings.threeTimesFeePercent} required /></label>
                <label><span>Paiement en 4 fois</span><select name="four_times_enabled" defaultValue={settings.fourTimesEnabled ? "true" : "false"}><option value="true">Disponible</option><option value="false">Désactivé</option></select></label>
                <label><span>Frais automatiques du 4×</span><input name="four_times_fee_percent" type="number" min="0" max="50" step="0.1" defaultValue={settings.fourTimesFeePercent} required /></label>
                <label><span>Jours entre les échéances</span><input name="installment_interval_days" type="number" min="1" max="365" defaultValue={settings.installmentIntervalDays} required /></label>
                <button type="submit">Enregistrer les règles</button>
              </form>
            </section>

            <FinancingSection title="Dossiers à examiner" applications={pending} banking={bankingByApplication} reviewable />
            <FinancingSection title="Financements en cours" applications={current} banking={bankingByApplication} />
            <FinancingSection title="Historique" applications={archived} banking={bankingByApplication} />
          </>
        )}
      </main>
    </DashboardShell>
  );
}

function FinancingSection({
  title,
  applications,
  banking,
  reviewable = false,
}: {
  title: string;
  applications: VehicleFinancingApplication[];
  banking: Map<number, CitizenBankInformation>;
  reviewable?: boolean;
}) {
  return (
    <section className={styles.section}>
      <header><h2>{title}</h2><span>{applications.length}</span></header>
      <div className={styles.list}>
        {applications.length === 0 && <div className={styles.empty}>Aucun dossier dans cette rubrique.</div>}
        {applications.map((application) => (
          <FinancingCard
            key={application.id}
            application={application}
            banking={banking.get(application.id)}
            reviewable={reviewable}
          />
        ))}
      </div>
    </section>
  );
}

function FinancingCard({
  application,
  banking,
  reviewable,
}: {
  application: VehicleFinancingApplication;
  banking?: CitizenBankInformation;
  reviewable: boolean;
}) {
  const initialPayment = application.down_payment_amount + application.delivery_fee;
  const bankBalance =
    banking?.status === "connected"
      ? banking.accounts.reduce((sum, account) => sum + account.balance, 0)
      : null;
  const firstInstallment = application.financed_total / application.term_count;
  const canCoverDeposit = bankBalance !== null && bankBalance >= initialPayment;
  const reviewedBalance = application.bank_balance_at_review;

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>{application.application_number}</p>
          <h3>{application.customer_name}</h3>
          <span>{application.vehicle_name} · {money(application.vehicle_price)}</span>
        </div>
        <span className={styles.status}>{statusLabels[application.status] ?? application.status}</span>
      </header>

      <div className={styles.moneyGrid}>
        <div><span>Formule</span><strong>{application.term_count} échéances</strong></div>
        <div><span>Apport obligatoire</span><strong>{money(application.down_payment_amount)}</strong></div>
        <div><span>Frais ({application.fee_percent} %)</span><strong>{money(application.fee_amount)}</strong></div>
        <div><span>Chaque échéance environ</span><strong>{money(firstInstallment)}</strong></div>
        <div><span>Total financé avec frais</span><strong>{money(application.financed_total)}</strong></div>
        <div><span>Premier paiement avec livraison</span><strong>{money(initialPayment)}</strong></div>
      </div>

      <section className={`${styles.bankPanel} ${canCoverDeposit ? styles.bankPositive : styles.bankWarning}`}>
        <header>
          <div><p className={styles.eyebrow}>SOLDE ACTUEL EN JEU</p><h4>{banking?.citizenName || application.customer_name}</h4></div>
          <span>{banking?.status === "connected" ? "Lecture en direct" : "Connexion indisponible"}</span>
        </header>
        {banking?.status === "connected" ? (
          <div className={styles.bankAmounts}>
            <div><span>Comptes bancaires</span><strong>{money(bankBalance)}</strong></div>
            <div><span>Espèces</span><strong>{money(banking.cash)}</strong></div>
            <div><span>Total disponible</span><strong>{money(banking.total)}</strong></div>
            <div><span>Contrôle de l’apport</span><strong>{canCoverDeposit ? "Apport couvert" : `Il manque ${money(initialPayment - (bankBalance ?? 0))}`}</strong></div>
          </div>
        ) : reviewedBalance !== null ? (
          <div className={styles.bankAmounts}>
            <div><span>Solde lors de la décision</span><strong>{money(reviewedBalance)}</strong></div>
            <div><span>Date du contrôle</span><strong>{date(application.bank_checked_at)}</strong></div>
          </div>
        ) : (
          <p className={styles.bankUnavailable}>
            {banking?.status === "identity_missing" ? "Aucun compte Steam n’est lié à ce citoyen." : banking?.status === "not_found" ? "Le personnage n’a pas été trouvé dans la base du serveur." : banking?.status === "not_configured" ? "La liaison avec la banque du serveur est prête mais pas encore configurée." : "La banque du serveur ne répond pas actuellement."}
          </p>
        )}
        <small>Dernière vérification : {date(banking?.checkedAt ?? application.bank_checked_at)} · Steam •••• {application.steam_id?.slice(-4) ?? "non lié"}</small>
      </section>

      {application.customer_note && <div className={styles.note}><span>MESSAGE DU CITOYEN</span><p>{application.customer_note}</p></div>}
      {application.review_note && <div className={styles.note}><span>DÉCISION DE LA DIRECTION</span><p>{application.review_note}</p></div>}

      {application.installments.length > 0 && (
        <div className={styles.schedule}>
          {application.installments.map((installment) => (
            <div key={installment.id}>
              <span>Échéance {installment.installment_number} · {date(installment.due_at)}</span>
              <strong>{money(installment.amount)}</strong>
              <em>{installment.status === "paid" ? "Payée" : installment.status === "cancelled" ? "Annulée" : "À payer"}</em>
            </div>
          ))}
        </div>
      )}

      {reviewable && application.status === "pending_review" && (
        <form action={reviewVehicleFinancingApplication} className={styles.reviewForm}>
          <input type="hidden" name="application_id" value={application.id} />
          <label><span>Message ou motif transmis au citoyen</span><textarea name="review_note" rows={3} maxLength={2000} placeholder="Facultatif pour accepter, obligatoire pour refuser." /></label>
          <div>
            <button className={styles.approve} type="submit" name="decision" value="approve">Accepter le dossier</button>
            <button className={styles.reject} type="submit" name="decision" value="reject">Refuser le dossier</button>
          </div>
        </form>
      )}

      <footer className={styles.cardFooter}>
        <span>Créé le {date(application.created_at)}</span>
        <DeleteFinancingApplicationButton
          applicationId={application.id}
          applicationNumber={application.application_number}
          isInProgress={["deposit_due", "active"].includes(application.status)}
        />
      </footer>
    </article>
  );
}
