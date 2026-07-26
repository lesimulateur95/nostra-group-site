import { createAccountingEntry, deleteAccountingEntry } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAccountingEntries, type AccountingEntry } from "@/lib/backoffice/data";
import styles from "./comptabilite.module.css";

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
  return new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(date)
    .replace(".", "");
}

function entryTotal(
  entries: AccountingEntry[],
  type: AccountingEntry["entry_type"],
) {
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
  const balance = income - expenses;
  const netMargin = income > 0 ? (balance / income) * 100 : 0;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentMonthKey = monthKey(now);
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthKey = monthKey(previousMonthDate);

  const currentMonthEntries = entries.filter((entry) =>
    entry.entry_date.startsWith(currentMonthKey),
  );
  const previousMonthEntries = entries.filter((entry) =>
    entry.entry_date.startsWith(previousMonthKey),
  );

  const currentMonthIncome = entryTotal(currentMonthEntries, "income");
  const currentMonthExpenses = entryTotal(currentMonthEntries, "expense");
  const currentMonthBalance = currentMonthIncome - currentMonthExpenses;
  const previousMonthBalance =
    entryTotal(previousMonthEntries, "income") -
    entryTotal(previousMonthEntries, "expense");
  const monthlyDifference = currentMonthBalance - previousMonthBalance;

  const categories = new Map<string, { income: number; expenses: number }>();
  for (const entry of entries) {
    const category = entry.category?.trim() || "Général";
    const totals = categories.get(category) ?? { income: 0, expenses: 0 };

    if (entry.entry_type === "income") totals.income += Number(entry.amount);
    else totals.expenses += Number(entry.amount);

    categories.set(category, totals);
  }

  const categoryRows = [...categories.entries()]
    .map(([category, totals]) => ({
      category,
      ...totals,
      balance: totals.income - totals.expenses,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.income) + Math.abs(b.expenses) -
        (Math.abs(a.income) + Math.abs(a.expenses)),
    );

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = monthKey(date);
    const monthEntries = entries.filter((entry) =>
      entry.entry_date.startsWith(key),
    );
    const monthIncome = entryTotal(monthEntries, "income");
    const monthExpenses = entryTotal(monthEntries, "expense");

    return {
      key,
      label: monthLabel(date),
      income: monthIncome,
      expenses: monthExpenses,
      balance: monthIncome - monthExpenses,
    };
  });

  const chartMaximum = Math.max(
    1,
    ...months.flatMap((month) => [month.income, month.expenses]),
  );

  return (
    <DashboardShell>
      <main className={styles.page}>
        <DashboardHeader
          title="Comptabilité"
          description="Une vue simple et propre des recettes, des dépenses et du résultat de Nostra Group."
        />

        {params.saved && (
          <div className="dashboard-feedback dashboard-feedback-success">
            L’opération a bien été enregistrée.
          </div>
        )}
        {params.deleted && (
          <div className="dashboard-feedback">
            L’opération a été supprimée et les totaux ont été actualisés.
          </div>
        )}
        {params.error && (
          <div className="dashboard-feedback dashboard-feedback-error">
            Vérifie la date, le type, le libellé et le montant. Les formats 50000,
            50 000 et 50.000 sont acceptés.
          </div>
        )}

        <section className={styles.summaryGrid} aria-label="Résumé financier">
          <article
            className={`${styles.summaryCard} ${styles.balanceCard} ${
              balance < 0 ? styles.negativeCard : ""
            }`}
          >
            <div className={styles.summaryHeading}>
              <span className={styles.summaryIcon}>€</span>
              <span>Résultat global</span>
            </div>
            <strong className={balance >= 0 ? styles.positive : styles.negative}>
              {euros(balance)}
            </strong>
            <div className={styles.summaryFooter}>
              <span>Marge nette</span>
              <b>{percent(netMargin)}</b>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <div className={styles.summaryHeading}>
              <span className={`${styles.summaryIcon} ${styles.incomeIcon}`}>↗</span>
              <span>Total des recettes</span>
            </div>
            <strong className={styles.positive}>{euros(income)}</strong>
            <div className={styles.summaryFooter}>
              <span>Ce mois-ci</span>
              <b>{euros(currentMonthIncome)}</b>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <div className={styles.summaryHeading}>
              <span className={`${styles.summaryIcon} ${styles.expenseIcon}`}>↘</span>
              <span>Total des dépenses</span>
            </div>
            <strong className={styles.negative}>{euros(expenses)}</strong>
            <div className={styles.summaryFooter}>
              <span>Ce mois-ci</span>
              <b>{euros(currentMonthExpenses)}</b>
            </div>
          </article>
        </section>

        <section className={styles.mainGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>NOUVELLE ÉCRITURE</span>
                <h2>Ajouter une opération</h2>
              </div>
              <span className={styles.panelBadge}>Manuel</span>
            </div>

            <form
              action={createAccountingEntry}
              className={styles.form}
              autoComplete="off"
            >
              <div className={styles.formRow}>
                <label>
                  Date
                  <input
                    type="date"
                    name="operation_date"
                    defaultValue={today}
                    required
                  />
                </label>

                <label>
                  Type
                  <select name="operation_type" defaultValue="income">
                    <option value="income">Recette</option>
                    <option value="expense">Dépense</option>
                  </select>
                </label>
              </div>

              <label>
                Catégorie
                <input
                  name="operation_category"
                  list="accounting-categories"
                  placeholder="Vente, circuit, entretien…"
                />
                <datalist id="accounting-categories">
                  <option value="Nostra Motors" />
                  <option value="Nostra Circuit" />
                  <option value="Événement" />
                  <option value="Entretien" />
                  <option value="Achat véhicule" />
                  <option value="Frais de fonctionnement" />
                </datalist>
              </label>

              <label>
                Libellé
                <input
                  name="operation_label"
                  placeholder="Exemple : vente Porsche 911"
                  required
                />
              </label>

              <label>
                Montant
                <div className={styles.amountInput}>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="operation_amount"
                    placeholder="300 000"
                    required
                  />
                  <span>€</span>
                </div>
              </label>

              <label>
                Note facultative
                <textarea
                  name="operation_notes"
                  rows={3}
                  placeholder="Client, facture ou information complémentaire"
                />
              </label>

              <button className={`btn ${styles.submitButton}`} type="submit">
                Enregistrer l’opération
              </button>
            </form>
          </article>

          <article className={`${styles.panel} ${styles.historyPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>JOURNAL COMPTABLE</span>
                <h2>Historique des opérations</h2>
              </div>
              <span className={styles.panelBadge}>{entries.length} écriture(s)</span>
            </div>

            <div className={styles.monthStrip}>
              <div>
                <span>Résultat du mois</span>
                <strong
                  className={
                    currentMonthBalance >= 0 ? styles.positive : styles.negative
                  }
                >
                  {euros(currentMonthBalance)}
                </strong>
              </div>
              <div>
                <span>Écart avec le mois précédent</span>
                <strong
                  className={
                    monthlyDifference >= 0 ? styles.positive : styles.negative
                  }
                >
                  {monthlyDifference >= 0 ? "+" : ""}
                  {euros(monthlyDifference)}
                </strong>
              </div>
            </div>

            <div className={styles.ledger}>
              {entries.length === 0 && (
                <div className={styles.emptyState}>
                  <span>€</span>
                  <strong>Aucune opération enregistrée</strong>
                  <p>Les prochaines écritures apparaîtront ici.</p>
                </div>
              )}

              {entries.map((entry) => (
                <article className={styles.ledgerRow} key={entry.id}>
                  <span
                    className={`${styles.typeBadge} ${
                      entry.entry_type === "income"
                        ? styles.incomeBadge
                        : styles.expenseBadge
                    }`}
                  >
                    {entry.entry_type === "income" ? "+" : "−"}
                  </span>

                  <div className={styles.ledgerCopy}>
                    <strong>{entry.label}</strong>
                    <span>
                      {new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(
                        "fr-FR",
                      )}
                      {" · "}
                      {entry.category || "Général"}
                    </span>
                    {entry.notes && <small>{entry.notes}</small>}
                  </div>

                  <strong
                    className={`${styles.ledgerAmount} ${
                      entry.entry_type === "income"
                        ? styles.positive
                        : styles.negative
                    }`}
                  >
                    {entry.entry_type === "income" ? "+" : "−"}
                    {euros(Number(entry.amount))}
                  </strong>

                  <form action={deleteAccountingEntry}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      className={styles.deleteButton}
                      type="submit"
                      aria-label={`Supprimer ${entry.label}`}
                      title="Supprimer l’opération"
                    >
                      ×
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className={styles.analysisGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>ÉVOLUTION</span>
                <h2>Les six derniers mois</h2>
              </div>
              <div className={styles.legend}>
                <span><i className={styles.incomeDot} /> Recettes</span>
                <span><i className={styles.expenseDot} /> Dépenses</span>
              </div>
            </div>

            <div className={styles.chart}>
              {months.map((month) => (
                <div className={styles.chartColumn} key={month.key}>
                  <div className={styles.chartBars}>
                    <span
                      className={styles.incomeBar}
                      style={{
                        height: `${Math.max(
                          month.income > 0 ? 6 : 0,
                          (month.income / chartMaximum) * 100,
                        )}%`,
                      }}
                      title={`Recettes : ${euros(month.income)}`}
                    />
                    <span
                      className={styles.expenseBar}
                      style={{
                        height: `${Math.max(
                          month.expenses > 0 ? 6 : 0,
                          (month.expenses / chartMaximum) * 100,
                        )}%`,
                      }}
                      title={`Dépenses : ${euros(month.expenses)}`}
                    />
                  </div>
                  <strong
                    className={
                      month.balance >= 0 ? styles.positive : styles.negative
                    }
                  >
                    {euros(month.balance)}
                  </strong>
                  <span>{month.label}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>RÉPARTITION</span>
                <h2>Résultat par catégorie</h2>
              </div>
              <span className={styles.panelBadge}>{categoryRows.length} catégorie(s)</span>
            </div>

            <div className={styles.categoryList}>
              {categoryRows.length === 0 && (
                <div className={styles.emptyState}>
                  <strong>Aucune catégorie à analyser</strong>
                </div>
              )}

              {categoryRows.map((row) => (
                <div className={styles.categoryRow} key={row.category}>
                  <div>
                    <strong>{row.category}</strong>
                    <span>
                      {euros(row.income)} de recettes · {euros(row.expenses)} de dépenses
                    </span>
                  </div>
                  <strong
                    className={row.balance >= 0 ? styles.positive : styles.negative}
                  >
                    {row.balance >= 0 ? "+" : ""}
                    {euros(row.balance)}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </DashboardShell>
  );
}
