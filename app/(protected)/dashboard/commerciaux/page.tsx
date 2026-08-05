import {
  payCommercialMonthV137,
  saveCommissionSettingsV137,
  saveCommercialObjectiveV137,
} from "@/app/actions/commercial-performance";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getRequestRoleKeys } from "@/lib/auth/request-context";
import {
  getCommercialOptionsV137,
  getCommercialPerformanceV137,
} from "@/lib/commercial-performance/data";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function currentMonth(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(new Date());
}

const statusLabels: Record<string, string> = {
  pending: "À valider",
  approved: "Validée",
  paid: "Payée",
  cancelled: "Annulée",
};

export default async function CommercialPerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, roles, performance] = await Promise.all([
    searchParams,
    getRequestRoleKeys(),
    getCommercialPerformanceV137(),
  ]);
  const manager = roles.includes("manager");
  const commercials = manager ? await getCommercialOptionsV137() : [];
  const month = currentMonth();
  const monthStart = `${month}-01`;
  const monthCommissions = performance.commissions.filter((item) => item.saleDate.startsWith(month));
  const sales = monthCommissions.filter((item) => item.status !== "cancelled");
  const revenue = sales.reduce((sum, item) => sum + item.saleAmount, 0);
  const paid = sales.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.commissionAmount, 0);
  const nostraNet = sales.reduce((sum, item) => sum + Math.max(0, item.saleAmount - item.commissionAmount), 0);
  const accountBalance = performance.accounts.reduce((sum, account) => sum + account.balance, 0);

  const summaries = [...new Set([
    ...performance.objectives.filter((item) => item.month === monthStart).map((item) => item.commercialUserId),
    ...monthCommissions.map((item) => item.commercialUserId),
  ])].map((userId) => {
    const commissions = monthCommissions.filter((item) => item.commercialUserId === userId && item.status !== "cancelled");
    const objective = performance.objectives.find((item) => item.commercialUserId === userId && item.month === monthStart);
    const name = objective?.commercialName || commissions[0]?.commercialName || "Commercial";
    const totalRevenue = commissions.reduce((sum, item) => sum + item.saleAmount, 0);
    const commissionPaid = commissions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.commissionAmount, 0);
    const reached = Boolean(objective && commissions.length >= objective.salesTarget && totalRevenue >= objective.revenueTarget);
    const monthPaid = performance.payments.some((item) => item.commercialUserId === userId && item.month === monthStart);
    const account = performance.accounts.find((item) => item.commercialUserId === userId);
    return { userId, name, commissions, objective, totalRevenue, commissionPaid, reached, monthPaid, account };
  });

  return (
    <DashboardShell allowedRoles={["manager", "commercial"]}>
      <DashboardHeader title="Commissions et objectifs commerciaux" description="Chaque paiement crédite automatiquement le compte du commercial et déduit sa commission du compte Nostra." />

      {!performance.configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Exécute le SQL V137</h2>
          <p>Le module sera ensuite relié automatiquement aux commandes Nostra Motors terminées.</p>
        </section>
      ) : (
        <>
          {params.settings && <div className="dashboard-feedback dashboard-feedback-success">Paramètres de commission enregistrés.</div>}
          {params.objective && <div className="dashboard-feedback dashboard-feedback-success">Objectif mensuel enregistré.</div>}
          {params.payment && <div className="dashboard-feedback dashboard-feedback-success">Prime d’objectif versée et ajoutée en comptabilité.</div>}
          {params.error && <div className="dashboard-feedback dashboard-feedback-error">{params.error === "paid" ? "Ce mois a déjà été payé." : params.error === "empty" ? "Aucune commission ni prime à payer pour ce mois." : "Impossible d’enregistrer cette action."}</div>}

          <section className={styles.kpis}>
            <article className={styles.kpi}><span>Ventes du mois</span><strong>{sales.length}</strong></article>
            <article className={styles.kpi}><span>Chiffre d’affaires</span><strong>{money(revenue)}</strong></article>
            <article className={styles.kpi}><span>Net conservé par Nostra</span><strong>{money(nostraNet)}</strong></article>
            <article className={styles.kpi}><span>Commissions créditées</span><strong>{money(paid)}</strong></article>
            <article className={styles.kpi}><span>Solde des comptes commerciaux</span><strong>{money(accountBalance)}</strong></article>
          </section>

          {manager && (
            <section className={styles.serviceLayout}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}><div><h2>Règle de commission</h2><p>Cette règle est appliquée dès que le paiement est enregistré et qu’un commercial est attribué.</p></div></div>
                <form action={saveCommissionSettingsV137} className={styles.form}>
                  <label>État<select name="enabled" defaultValue={performance.settings.enabled ? "true" : "false"}><option value="true">Commissions activées</option><option value="false">Commissions désactivées</option></select></label>
                  <label>Calcul<select name="commission_mode" defaultValue={performance.settings.mode}><option value="percent">Pourcentage de la vente</option><option value="fixed">Prime fixe par vente</option></select></label>
                  <label>Valeur<input name="commission_value" type="number" min="0" step="0.01" defaultValue={performance.settings.value} required /></label>
                  <button className={styles.primary}>Enregistrer la règle</button>
                </form>
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeader}><div><h2>Objectif mensuel</h2><p>Un objectif différent peut être attribué à chaque commercial.</p></div></div>
                {commercials.length === 0 ? <p className={styles.empty}>Aucun compte avec le rôle Commercial.</p> : (
                  <form action={saveCommercialObjectiveV137} className={styles.form}>
                    <label className={styles.span2}>Commercial<select name="commercial_user_id" required>{commercials.map((commercial) => <option key={commercial.userId} value={commercial.userId}>{commercial.name}</option>)}</select></label>
                    <label>Mois<input name="objective_month" type="month" defaultValue={month} required /></label>
                    <label>Nombre de ventes<input name="sales_target" type="number" min="0" defaultValue="5" required /></label>
                    <label>CA à atteindre<input name="revenue_target" type="number" min="0" step="1" defaultValue="1000000" required /></label>
                    <label>Prime d’objectif<input name="target_bonus" type="number" min="0" step="1" defaultValue="50000" required /></label>
                    <button className={styles.primary}>Créer ou modifier l’objectif</button>
                  </form>
                )}
              </article>
            </section>
          )}

          <section className={styles.section}>
            <div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">MOIS EN COURS</p><h2>Résultats par commercial</h2></div>
            <div className={styles.stack}>
              {summaries.length === 0 && <article className={styles.panel}><p className={styles.empty}>Aucune vente attribuée pour ce mois.</p></article>}
              {summaries.map((summary) => (
                <article className={styles.panel} key={summary.userId}>
                  <div className={styles.caseHead}><div><span className={styles.badge}>{summary.reached ? "Objectif atteint" : "En progression"}</span><h2>{summary.name}</h2><p>{summary.objective ? `Objectif : ${summary.objective.salesTarget} vente(s) et ${money(summary.objective.revenueTarget)}` : "Aucun objectif défini pour ce mois"}</p></div><strong>{money(summary.account?.balance ?? 0)}</strong></div>
                  <div className={styles.moneyGrid}><div><span>Ventes</span><strong>{summary.commissions.length}{summary.objective ? ` / ${summary.objective.salesTarget}` : ""}</strong></div><div><span>Chiffre d’affaires</span><strong>{money(summary.totalRevenue)}</strong></div><div><span>Commissions reçues</span><strong>{money(summary.commissionPaid)}</strong></div><div><span>Prime d’objectif</span><strong>{summary.reached ? money(summary.objective?.targetBonus ?? 0) : "Non acquise"}</strong></div></div>
                  <p className={styles.notice}>Compte commercial crédité automatiquement : <strong>{money(summary.account?.totalCredited ?? 0)}</strong> au total.</p>
                  {manager && !summary.monthPaid && (summary.reached ? summary.objective?.targetBonus ?? 0 : 0) > 0 && (
                    <form action={payCommercialMonthV137} className={styles.actions}>
                      <input type="hidden" name="commercial_user_id" value={summary.userId} />
                      <input type="hidden" name="payment_month" value={monthStart} />
                      <button className={styles.primary}>Verser la prime d’objectif</button>
                    </form>
                  )}
                  {summary.monthPaid && <p className={styles.notice}>Prime d’objectif de ce mois déjà versée.</p>}
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.section}`}>
            <div className={styles.panelHeader}><div><h2>Détail du compte commercial</h2><p>Prix payé, commission retirée automatiquement et montant net conservé par Nostra pour chaque vente.</p></div></div>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Commande</th><th>Commercial</th><th>Prix de vente</th><th>Commission créditée</th><th>Net Nostra</th><th>État</th></tr></thead><tbody>{performance.commissions.map((item) => <tr key={item.id}><td>{new Date(item.saleDate).toLocaleDateString("fr-FR")}</td><td>{item.orderNumber}</td><td>{item.commercialName}</td><td>{money(item.saleAmount)}</td><td>{money(item.commissionAmount)}</td><td>{money(Math.max(0, item.saleAmount - item.commissionAmount))}</td><td>{item.status === "paid" ? "Créditée automatiquement" : statusLabels[item.status] ?? item.status}</td></tr>)}{performance.commissions.length === 0 && <tr><td colSpan={7}>Aucune commission enregistrée.</td></tr>}</tbody></table></div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
