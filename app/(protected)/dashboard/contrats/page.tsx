import { redirect } from "next/navigation";

import {
  cancelContractInstallment,
  createCircuitContract,
  generateContractRenewals,
  updateCircuitContractPrice,
  updateCircuitContractStatus,
} from "@/app/actions/contracts";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getContractDashboardData } from "@/lib/contracts/data";
import { getMembersWithRoles } from "@/lib/member-roles/data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    created?: string;
    price_saved?: string;
    status_saved?: string;
    generated?: string;
    installment_cancelled?: string;
    error?: string;
  }>;
};

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

function dateLabel(value: string | null) {
  if (!value) return "Sans date de fin";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  active: "Actif",
  suspended: "Suspendu",
  terminated: "Résilié",
  expired: "Expiré",
};

export default async function ContractsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/dashboard");

  const [params, overview, members] = await Promise.all([
    searchParams,
    getContractDashboardData(),
    getMembersWithRoles(),
  ]);

  const message = params.created
    ? "Le contrat a été créé."
    : params.price_saved
      ? "Le nouveau tarif et sa date d’application ont été enregistrés."
      : params.status_saved
        ? "Le statut du contrat a été mis à jour."
        : params.generated
          ? "Les reconductions arrivées à échéance ont été ajoutées aux paniers."
          : params.installment_cancelled
            ? "La mensualité non payée a été annulée."
            : null;

  const errorMessage = params.error === "setup"
    ? "Exécute le SQL V114 pour activer les contrats."
    : params.error === "responsible"
      ? "Le responsable doit posséder un profil citoyen avec un nom RP."
      : params.error === "price"
        ? "Le nouveau prix ou sa date d’application est invalide."
        : params.error
          ? "L’opération n’a pas pu être enregistrée."
          : null;

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">NOSTRA CIRCUIT</span>
          <h1 className="page-title">Contrats professionnels</h1>
          <p className="lead">
            Crée des contrats mensuels pour les organisations. Chaque échéance
            apparaît dans le panier du responsable avec la mention
            « Reconduction du contrat ».
          </p>
        </div>
      </section>

      {message && (
        <div className="dashboard-feedback dashboard-feedback-success">{message}</div>
      )}
      {errorMessage && (
        <div className="dashboard-feedback dashboard-feedback-error">{errorMessage}</div>
      )}
      {!overview.configured && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Le module Contrats n’est pas encore activé dans Supabase.
        </div>
      )}

      <section className="dashboard-panel contract-create-panel-v114">
        <div className="dashboard-section-heading dashboard-section-heading-tight">
          <p className="eyebrow">NOUVEAU CONTRAT</p>
          <h2>Créer un contrat mensuel</h2>
        </div>

        <form action={createCircuitContract} className="contract-form-grid-v114">
          <label>
            <span>Organisation</span>
            <input name="organization_name" required maxLength={180} placeholder="Gendarmerie" />
          </label>
          <label>
            <span>Responsable du paiement</span>
            <select name="responsible_user_id" required defaultValue="">
              <option value="" disabled>Choisir un citoyen</option>
              {members.members.map((member) => {
                const name = [member.rp_first_name, member.rp_last_name]
                  .filter(Boolean)
                  .join(" ") || member.discord_name || member.email || member.user_id;
                return <option value={member.user_id} key={member.user_id}>{name}</option>;
              })}
            </select>
          </label>
          <label>
            <span>Prix mensuel</span>
            <input name="monthly_price" type="number" min="0" step="1" required placeholder="75000" />
          </label>
          <label>
            <span>Jour de facturation</span>
            <input name="billing_day" type="number" min="1" max="28" defaultValue="1" required />
          </label>
          <label>
            <span>Délai de paiement en jours</span>
            <input name="payment_due_days" type="number" min="0" max="31" defaultValue="10" required />
          </label>
          <label>
            <span>Date de début</span>
            <input name="started_on" type="date" required />
          </label>
          <label>
            <span>Date de fin facultative</span>
            <input name="ends_on" type="date" />
          </label>
          <label>
            <span>Nombre de personnes autorisées</span>
            <input name="authorized_people" type="number" min="1" />
          </label>
          <label className="contract-form-wide-v114">
            <span>Accès prévu</span>
            <textarea
              name="access_scope"
              rows={3}
              defaultValue="Accès mensuel au circuit pour les entraînements"
            />
          </label>
          <label className="contract-form-wide-v114">
            <span>Notes internes</span>
            <textarea name="notes" rows={3} />
          </label>
          <button className="btn contract-form-wide-v114" type="submit">Créer le contrat</button>
        </form>
      </section>

      <form action={generateContractRenewals} className="contract-generation-bar-v114">
        <div>
          <strong>Reconductions mensuelles</strong>
          <p>Le site les génère aussi automatiquement quand le responsable ouvre son profil.</p>
        </div>
        <button className="btn" type="submit">Générer les échéances dues</button>
      </form>

      <div className="contract-list-v114">
        {overview.contracts.length === 0 && (
          <p className="empty-state">Aucun contrat professionnel enregistré.</p>
        )}

        {overview.contracts.map((contract) => {
          const installments = overview.installments.filter(
            (item) => item.contract_id === contract.id,
          );
          const prices = overview.prices.filter(
            (item) => item.contract_id === contract.id,
          );

          return (
            <article className="dashboard-panel contract-card-v114" key={contract.id}>
              <header>
                <div>
                  <span className="eyebrow">{contract.contract_number}</span>
                  <h2>{contract.organization_name}</h2>
                  <p>Responsable : {contract.responsible_name}</p>
                </div>
                <span className={`role-badge contract-status-${contract.status}`}>
                  {statusLabels[contract.status] ?? contract.status}
                </span>
              </header>

              <dl className="contract-summary-v114">
                <div><dt>Tarif actuel</dt><dd>{money(contract.monthly_price)} / mois</dd></div>
                <div><dt>Début</dt><dd>{dateLabel(contract.started_on)}</dd></div>
                <div><dt>Fin</dt><dd>{dateLabel(contract.ends_on)}</dd></div>
                <div><dt>Prochaine facturation</dt><dd>{dateLabel(contract.next_billing_on)}</dd></div>
              </dl>

              <p className="contract-access-v114">{contract.access_scope}</p>

              <div className="contract-actions-grid-v114">
                <form action={updateCircuitContractPrice} className="contract-inline-form-v114">
                  <input type="hidden" name="contract_id" value={contract.id} />
                  <strong>Modifier les prochains tarifs</strong>
                  <label><span>Nouveau prix</span><input name="new_price" type="number" min="0" step="1" required /></label>
                  <label><span>Applicable à partir du</span><input name="effective_from" type="date" required /></label>
                  <label><span>Motif</span><input name="reason" maxLength={1000} placeholder="Évolution des conditions d’accès" /></label>
                  <button className="btn" type="submit">Enregistrer le tarif</button>
                </form>

                <form action={updateCircuitContractStatus} className="contract-inline-form-v114">
                  <input type="hidden" name="contract_id" value={contract.id} />
                  <strong>État du contrat</strong>
                  <label>
                    <span>Nouveau statut</span>
                    <select name="status" defaultValue={contract.status}>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <button className="btn" type="submit">Mettre à jour</button>
                </form>
              </div>

              <details className="contract-history-v114">
                <summary>Historique des tarifs ({prices.length})</summary>
                <div>
                  {prices.map((price) => (
                    <p key={price.id}>
                      <strong>{money(price.amount)}</strong> à partir du {dateLabel(price.effective_from)}
                      {price.reason ? ` — ${price.reason}` : ""}
                    </p>
                  ))}
                </div>
              </details>

              <details className="contract-history-v114">
                <summary>Mensualités ({installments.length})</summary>
                <div className="contract-installment-list-v114">
                  {installments.length === 0 && <p>Aucune mensualité générée.</p>}
                  {installments.map((installment) => (
                    <div key={installment.id}>
                      <span>
                        <strong>{installment.item_name}</strong>
                        <small>Échéance : {dateLabel(installment.due_on)}</small>
                      </span>
                      <strong>{money(installment.amount)}</strong>
                      <span className="role-badge">{installment.status === "in_cart" ? "Au panier" : installment.status === "paid" ? "Payé" : "Annulé"}</span>
                      {installment.status === "in_cart" && (
                        <form action={cancelContractInstallment}>
                          <input type="hidden" name="installment_id" value={installment.id} />
                          <button type="submit">Annuler</button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </DashboardShell>
  );
}
