import { createAccountingEntry, deleteAccountingEntry } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAccountingEntries, type AccountingEntry } from "@/lib/backoffice/data";

function euros(value: number) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function percent(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" })
    .format(date)
    .replace(".", "");
}

function entryTotal(entries: AccountingEntry[], type: AccountingEntry["entry_type"]) {
  return entries
    .filter((entry) => entry.entry_type === type)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const entries = await getAccountingEntries();
  const income = entryTotal(entries, "income");
  const expenses = entryTotal(entries, "expense");
  const profit = income - expenses;
  const netMargin = income > 0 ? (profit / income) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const currentMonthKey = monthKey(now);
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthKey = monthKey(previousMonthDate);

  const currentMonthEntries = entries.filter((entry) => entry.entry_date.startsWith(currentMonthKey));
  const previousMonthEntries = entries.filter((entry) => entry.entry_date.startsWith(previousMonthKey));
  const currentMonthIncome = entryTotal(currentMonthEntries, "income");
  const currentMonthExpenses = entryTotal(currentMonthEntries, "expense");
  const currentMonthProfit = currentMonthIncome - currentMonthExpenses;
  const previousMonthProfit = entryTotal(previousMonthEntries, "income") - entryTotal(previousMonthEntries, "expense");
  const profitDifference = currentMonthProfit - previousMonthProfit;

  const categories = new Map<string, { income: number; expenses: number }>();
  for (const entry of entries) {
    const category = entry.category?.trim() || "Général";
    const current = categories.get(category) ?? { income: 0, expenses: 0 };
    if (entry.entry_type === "income") current.income += Number(entry.amount);
    else current.expenses += Number(entry.amount);
    categories.set(category, current);
  }

  const categoryRows = [...categories.entries()]
    .map(([category, totals]) => ({
      category,
      ...totals,
      profit: totals.income - totals.expenses,
    }))
    .sort((a, b) => Math.abs(b.income) + Math.abs(b.expenses) - (Math.abs(a.income) + Math.abs(a.expenses)));

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = monthKey(date);
    const monthEntries = entries.filter((entry) => entry.entry_date.startsWith(key));
    const monthIncome = entryTotal(monthEntries, "income");
    const monthExpenses = entryTotal(monthEntries, "expense");
    return {
      key,
      label: monthLabel(date),
      income: monthIncome,
      expenses: monthExpenses,
      profit: monthIncome - monthExpenses,
    };
  });
  const chartMaximum = Math.max(1, ...months.flatMap((month) => [month.income, month.expenses]));

  return (
    <DashboardShell>
      <DashboardHeader
        title="Comptabilité"
        description="Pilote les recettes, les charges et le bénéfice net de Nostra Group depuis une vue claire et centralisée."
      />

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">L’opération a bien été enregistrée.</div>}
      {params.deleted && <div className="dashboard-feedback">L’opération a été supprimée et les calculs ont été actualisés.</div>}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          Vérifie la date, le type, le libellé et le montant. Les formats 50000, 50 000 et 50.000 sont acceptés.
        </div>
      )}

      <section className={`accounting-profit-hero ${profit < 0 ? "accounting-profit-hero-negative" : ""}`}>
        <div>
          <span className="accounting-eyebrow">Résultat global</span>
          <h2>Bénéfice net</h2>
          <strong>{euros(profit)}</strong>
          <p>Calcul automatique : total des recettes − total des dépenses.</p>
        </div>
        <div className="accounting-profit-meta">
          <div>
            <span>Marge nette</span>
            <strong>{percent(netMargin)}</strong>
          </div>
          <div>
            <span>Ce mois-ci</span>
            <strong className={currentMonthProfit >= 0 ? "positive-number" : "negative-number"}>{euros(currentMonthProfit)}</strong>
          </div>
          <div>
            <span>Évolution mensuelle</span>
            <strong className={profitDifference >= 0 ? "positive-number" : "negative-number"}>
              {profitDifference >= 0 ? "+" : ""}{euros(profitDifference)}
            </strong>
          </div>
        </div>
      </section>

      <section className="accounting-kpi-grid">
        <article className="accounting-kpi-card accounting-kpi-income">
          <span>Chiffre d’affaires</span>
          <strong>{euros(income)}</strong>
          <small>{entries.filter((entry) => entry.entry_type === "income").length} recette(s)</small>
        </article>
        <article className="accounting-kpi-card accounting-kpi-expense">
          <span>Total des charges</span>
          <strong>{euros(expenses)}</strong>
          <small>{entries.filter((entry) => entry.entry_type === "expense").length} dépense(s)</small>
        </article>
        <article className="accounting-kpi-card">
          <span>Recettes du mois</span>
          <strong>{euros(currentMonthIncome)}</strong>
          <small>Mois en cours</small>
        </article>
        <article className="accounting-kpi-card">
          <span>Charges du mois</span>
          <strong>{euros(currentMonthExpenses)}</strong>
          <small>Mois en cours</small>
        </article>
      </section>

      <section className="accounting-main-grid">
        <article className="backoffice-panel accounting-entry-panel">
          <div className="panel-heading">
            <span className="panel-icon">＋</span>
            <div>
              <h2>Ajouter une opération</h2>
              <p>Chaque saisie met immédiatement à jour le bénéfice.</p>
            </div>
          </div>

          <form action={createAccountingEntry} className="accounting-entry-form" autoComplete="off">
            <label>
              Date
              <input type="date" name="operation_date" defaultValue={today} required />
            </label>
            <label>
              Type
              <select name="operation_type" defaultValue="income">
                <option value="income">Recette</option>
                <option value="expense">Dépense</option>
              </select>
            </label>
            <label>
              Catégorie
              <input name="operation_category" placeholder="Vente, circuit, entretien…" />
            </label>
            <label>
              Libellé
              <input name="operation_label" placeholder="Exemple : vente Porsche 911" required />
            </label>
            <label className="accounting-amount-field">
              Montant (€)
              <input type="text" inputMode="decimal" name="operation_amount" placeholder="Exemple : 300 000" required />
            </label>
            <label className="accounting-form-wide">
              Note
              <textarea name="operation_notes" rows={3} placeholder="Client, numéro de facture ou information complémentaire" />
            </label>
            <button className="btn accounting-submit" type="submit">Enregistrer l’opération</button>
          </form>
        </article>

        <article className="backoffice-panel accounting-chart-panel">
          <div className="panel-heading">
            <span className="panel-icon">↗</span>
            <div>
              <h2>Évolution sur 6 mois</h2>
              <p>Comparaison des recettes et des dépenses.</p>
            </div>
          </div>
          <div className="accounting-chart-legend">
            <span><i className="accounting-legend-income" /> Recettes</span>
            <span><i className="accounting-legend-expense" /> Dépenses</span>
          </div>
          <div className="accounting-month-chart">
            {months.map((month) => (
              <div className="accounting-month-column" key={month.key}>
                <div className="accounting-bars" aria-label={`${month.label} : ${euros(month.income)} de recettes et ${euros(month.expenses)} de dépenses`}>
                  <span
                    className="accounting-bar accounting-bar-income"
                    style={{ height: `${Math.max(4, (month.income / chartMaximum) * 100)}%` }}
                    title={`Recettes : ${euros(month.income)}`}
                  />
                  <span
                    className="accounting-bar accounting-bar-expense"
                    style={{ height: `${Math.max(4, (month.expenses / chartMaximum) * 100)}%` }}
                    title={`Dépenses : ${euros(month.expenses)}`}
                  />
                </div>
                <strong className={month.profit >= 0 ? "positive-number" : "negative-number"}>{euros(month.profit)}</strong>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="accounting-secondary-grid">
        <article className="backoffice-panel">
          <div className="panel-heading">
            <span className="panel-icon">≡</span>
            <div>
              <h2>Résultat par catégorie</h2>
              <p>Repère rapidement les activités rentables et les postes coûteux.</p>
            </div>
          </div>
          <div className="accounting-category-list">
            {categoryRows.length === 0 && <p className="empty-state">Aucune catégorie à analyser.</p>}
            {categoryRows.map((row) => (
              <div className="accounting-category-row" key={row.category}>
                <strong>{row.category}</strong>
                <div><span>Recettes</span><b className="positive-number">{euros(row.income)}</b></div>
                <div><span>Dépenses</span><b className="negative-number">{euros(row.expenses)}</b></div>
                <div><span>Bénéfice</span><b className={row.profit >= 0 ? "positive-number" : "negative-number"}>{euros(row.profit)}</b></div>
              </div>
            ))}
          </div>
        </article>

        <article className="backoffice-panel accounting-ledger-panel">
          <div className="panel-heading">
            <span className="panel-icon">€</span>
            <div>
              <h2>Historique des opérations</h2>
              <p>Les 100 opérations les plus récentes.</p>
            </div>
          </div>
          <div className="accounting-ledger">
            {entries.length === 0 && <p className="empty-state">Aucune opération enregistrée.</p>}
            {entries.map((entry) => (
              <article className="accounting-ledger-row" key={entry.id}>
                <span className={`accounting-type-badge ${entry.entry_type === "income" ? "accounting-type-income" : "accounting-type-expense"}`}>
                  {entry.entry_type === "income" ? "Recette" : "Dépense"}
                </span>
                <div className="accounting-ledger-copy">
                  <strong>{entry.label}</strong>
                  <span>
                    {new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString("fr-FR")} · {entry.category}
                  </span>
                  {entry.notes && <small>{entry.notes}</small>}
                </div>
                <strong className={entry.entry_type === "income" ? "positive-number" : "negative-number"}>
                  {entry.entry_type === "income" ? "+" : "−"}{euros(Number(entry.amount))}
                </strong>
                <form action={deleteAccountingEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="icon-delete" type="submit" aria-label={`Supprimer ${entry.label}`}>×</button>
                </form>
              </article>
            ))}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
