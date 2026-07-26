import Link from "next/link";
import { createAccountingEntry, deleteAccountingEntry } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAccountingEntries, type AccountingEntry } from "@/lib/backoffice/data";
import styles from "./comptabilite.module.css";

type SearchParams = Record<string, string | string[] | undefined>;
type Period = "month" | "30" | "90" | "year" | "all";
type EntryFilter = "all" | AccountingEntry["entry_type"];

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function currency(value: number, maximumFractionDigits = 0) {
  return Number(value || 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits,
  });
}

function signedCurrency(value: number) {
  return `${value > 0 ? "+" : ""}${currency(value)}`;
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "0"} %`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(date)
    .replace(".", "");
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function totalByType(entries: AccountingEntry[], type: AccountingEntry["entry_type"]) {
  return entries
    .filter((entry) => entry.entry_type === type)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

function periodStart(period: Period, now: Date) {
  if (period === "all") return null;
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);

  const days = period === "30" ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isPeriod(value: string): value is Period {
  return ["month", "30", "90", "year", "all"].includes(value);
}

function isEntryFilter(value: string): value is EntryFilter {
  return ["all", "income", "expense"].includes(value);
}

function trendLabel(value: number) {
  if (value === 0) return "Stable";
  return value > 0 ? "En hausse" : "En baisse";
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const entries = await getAccountingEntries();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const requestedPeriod = scalar(params.period);
  const requestedType = scalar(params.type);
  const period: Period = isPeriod(requestedPeriod) ? requestedPeriod : "month";
  const entryType: EntryFilter = isEntryFilter(requestedType) ? requestedType : "all";
  const categoryFilter = scalar(params.category).trim();
  const search = scalar(params.q).trim().toLocaleLowerCase("fr-FR");
  const start = periodStart(period, now);

  const availableCategories = [...new Set(
    entries.map((entry) => entry.category?.trim() || "Général"),
  )].sort((a, b) => a.localeCompare(b, "fr-FR"));

  const filteredEntries = [...entries]
    .filter((entry) => {
      const entryDate = new Date(`${entry.entry_date}T12:00:00`);
      const category = entry.category?.trim() || "Général";
      const matchesPeriod = !start || entryDate >= start;
      const matchesType = entryType === "all" || entry.entry_type === entryType;
      const matchesCategory = !categoryFilter || category === categoryFilter;
      const haystack = `${entry.label} ${category} ${entry.notes ?? ""}`.toLocaleLowerCase("fr-FR");
      const matchesSearch = !search || haystack.includes(search);
      return matchesPeriod && matchesType && matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const dateDifference = b.entry_date.localeCompare(a.entry_date);
      return dateDifference || String(b.id).localeCompare(String(a.id));
    });

  const income = totalByType(filteredEntries, "income");
  const expenses = totalByType(filteredEntries, "expense");
  const balance = income - expenses;
  const margin = income > 0 ? (balance / income) * 100 : 0;
  const averageEntry = filteredEntries.length
    ? filteredEntries.reduce((sum, entry) => sum + Number(entry.amount), 0) / filteredEntries.length
    : 0;

  const currentMonth = monthKey(now);
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = monthKey(previousMonthDate);
  const currentMonthEntries = entries.filter((entry) => entry.entry_date.startsWith(currentMonth));
  const previousMonthEntries = entries.filter((entry) => entry.entry_date.startsWith(previousMonth));
  const currentMonthBalance = totalByType(currentMonthEntries, "income") - totalByType(currentMonthEntries, "expense");
  const previousMonthBalance = totalByType(previousMonthEntries, "income") - totalByType(previousMonthEntries, "expense");
  const monthlyDifference = currentMonthBalance - previousMonthBalance;
  const expenseRate = income > 0 ? (expenses / income) * 100 : expenses > 0 ? 100 : 0;

  const categories = new Map<string, { income: number; expenses: number; count: number }>();
  for (const entry of filteredEntries) {
    const category = entry.category?.trim() || "Général";
    const totals = categories.get(category) ?? { income: 0, expenses: 0, count: 0 };
    if (entry.entry_type === "income") totals.income += Number(entry.amount);
    else totals.expenses += Number(entry.amount);
    totals.count += 1;
    categories.set(category, totals);
  }

  const categoryRows = [...categories.entries()]
    .map(([category, totals]) => ({
      category,
      ...totals,
      balance: totals.income - totals.expenses,
      volume: totals.income + totals.expenses,
    }))
    .sort((a, b) => b.volume - a.volume);
  const categoryMaximum = Math.max(1, ...categoryRows.map((row) => row.volume));

  const months = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (7 - index), 1);
    const key = monthKey(date);
    const monthEntries = entries.filter((entry) => entry.entry_date.startsWith(key));
    const monthIncome = totalByType(monthEntries, "income");
    const monthExpenses = totalByType(monthEntries, "expense");
    return {
      key,
      label: monthLabel(date),
      income: monthIncome,
      expenses: monthExpenses,
      balance: monthIncome - monthExpenses,
    };
  });
  const chartMaximum = Math.max(1, ...months.flatMap((month) => [month.income, month.expenses]));

  const activeFilters = [
    period !== "month",
    entryType !== "all",
    Boolean(categoryFilter),
    Boolean(search),
  ].filter(Boolean).length;

  return (
    <DashboardShell>
      <main className={styles.page}>
        <div className={styles.hero}>
          <DashboardHeader
            title="Comptabilité"
            description="Pilotage financier de Nostra Group : trésorerie, écritures, tendances et ventilation par activité."
          />
          <div className={styles.heroMeta}>
            <span className={styles.statusDot} />
            Données actualisées au {now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>

        {params.saved && (
          <div className="dashboard-feedback dashboard-feedback-success">
            L’écriture a bien été enregistrée.
          </div>
        )}
        {params.deleted && (
          <div className="dashboard-feedback">
            L’écriture a été supprimée et les indicateurs ont été recalculés.
          </div>
        )}
        {params.error && (
          <div className="dashboard-feedback dashboard-feedback-error">
            Vérifie la date, le type, le libellé et le montant saisi.
          </div>
        )}

        <section className={styles.toolbar} aria-label="Filtres comptables">
          <form className={styles.filters} method="get">
            <label>
              <span>Période</span>
              <select name="period" defaultValue={period}>
                <option value="month">Mois en cours</option>
                <option value="30">30 derniers jours</option>
                <option value="90">90 derniers jours</option>
                <option value="year">Année en cours</option>
                <option value="all">Depuis le début</option>
              </select>
            </label>

            <label>
              <span>Flux</span>
              <select name="type" defaultValue={entryType}>
                <option value="all">Tous les flux</option>
                <option value="income">Recettes</option>
                <option value="expense">Dépenses</option>
              </select>
            </label>

            <label>
              <span>Catégorie</span>
              <select name="category" defaultValue={categoryFilter}>
                <option value="">Toutes les catégories</option>
                {availableCategories.map((category) => (
                  <option value={category} key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className={styles.searchField}>
              <span>Recherche</span>
              <input name="q" defaultValue={scalar(params.q)} placeholder="Libellé, note, catégorie…" />
            </label>

            <button className={styles.filterButton} type="submit">Appliquer</button>
            <Link className={styles.resetButton} href="/dashboard/comptabilite">Réinitialiser</Link>
          </form>
          <div className={styles.filterSummary}>
            <strong>{filteredEntries.length}</strong> écriture(s)
            {activeFilters > 0 && <span>{activeFilters} filtre(s) actif(s)</span>}
          </div>
        </section>

        <section className={styles.kpiGrid} aria-label="Indicateurs financiers">
          <article className={`${styles.kpiCard} ${styles.primaryKpi} ${balance < 0 ? styles.dangerKpi : ""}`}>
            <div className={styles.kpiTopline}>
              <span>Solde net</span>
              <i>01</i>
            </div>
            <strong className={balance >= 0 ? styles.positive : styles.negative}>{currency(balance)}</strong>
            <div className={styles.kpiFooter}>
              <span>Marge nette</span>
              <b>{percent(margin)}</b>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTopline}>
              <span>Recettes</span>
              <i className={styles.incomeMark}>↗</i>
            </div>
            <strong>{currency(income)}</strong>
            <div className={styles.kpiFooter}>
              <span>Part conservée</span>
              <b>{percent(Math.max(0, 100 - expenseRate))}</b>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTopline}>
              <span>Dépenses</span>
              <i className={styles.expenseMark}>↘</i>
            </div>
            <strong>{currency(expenses)}</strong>
            <div className={styles.kpiFooter}>
              <span>Poids sur les recettes</span>
              <b>{percent(expenseRate)}</b>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTopline}>
              <span>Montant moyen</span>
              <i>Ø</i>
            </div>
            <strong>{currency(averageEntry)}</strong>
            <div className={styles.kpiFooter}>
              <span>Nombre d’écritures</span>
              <b>{filteredEntries.length}</b>
            </div>
          </article>
        </section>

        <section className={styles.insightGrid}>
          <article className={`${styles.panel} ${styles.cashflowPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>TRÉSORERIE</span>
                <h2>Évolution des flux</h2>
                <p>Comparatif des recettes et dépenses sur les huit derniers mois.</p>
              </div>
              <div className={styles.legend}>
                <span><i className={styles.incomeDot} /> Recettes</span>
                <span><i className={styles.expenseDot} /> Dépenses</span>
              </div>
            </div>

            <div className={styles.chart}>
              {months.map((month) => (
                <div className={styles.chartColumn} key={month.key}>
                  <div className={styles.chartValue}>{currency(month.balance)}</div>
                  <div className={styles.chartBars}>
                    <span
                      className={styles.incomeBar}
                      style={{ height: `${Math.max(month.income > 0 ? 5 : 0, (month.income / chartMaximum) * 100)}%` }}
                      title={`Recettes : ${currency(month.income)}`}
                    />
                    <span
                      className={styles.expenseBar}
                      style={{ height: `${Math.max(month.expenses > 0 ? 5 : 0, (month.expenses / chartMaximum) * 100)}%` }}
                      title={`Dépenses : ${currency(month.expenses)}`}
                    />
                  </div>
                  <span>{month.label}</span>
                </div>
              ))}
            </div>
          </article>

          <aside className={`${styles.panel} ${styles.performancePanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>PERFORMANCE</span>
                <h2>Mois en cours</h2>
              </div>
              <span className={`${styles.trendBadge} ${monthlyDifference < 0 ? styles.trendDown : ""}`}>
                {trendLabel(monthlyDifference)}
              </span>
            </div>

            <div className={styles.performanceValue}>
              <span>Résultat mensuel</span>
              <strong className={currentMonthBalance >= 0 ? styles.positive : styles.negative}>
                {currency(currentMonthBalance)}
              </strong>
            </div>

            <dl className={styles.performanceList}>
              <div>
                <dt>Mois précédent</dt>
                <dd>{currency(previousMonthBalance)}</dd>
              </div>
              <div>
                <dt>Écart mensuel</dt>
                <dd className={monthlyDifference >= 0 ? styles.positive : styles.negative}>
                  {signedCurrency(monthlyDifference)}
                </dd>
              </div>
              <div>
                <dt>Recettes du mois</dt>
                <dd>{currency(totalByType(currentMonthEntries, "income"))}</dd>
              </div>
              <div>
                <dt>Dépenses du mois</dt>
                <dd>{currency(totalByType(currentMonthEntries, "expense"))}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className={styles.workspaceGrid}>
          <article className={`${styles.panel} ${styles.ledgerPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>GRAND LIVRE</span>
                <h2>Journal des opérations</h2>
                <p>Historique filtré des mouvements comptables enregistrés.</p>
              </div>
              <span className={styles.countBadge}>{filteredEntries.length} ligne(s)</span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className={styles.emptyState}>
                <span>€</span>
                <strong>Aucune écriture trouvée</strong>
                <p>Modifie les filtres ou ajoute une nouvelle opération.</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Libellé</th>
                      <th>Catégorie</th>
                      <th>Type</th>
                      <th className={styles.amountColumn}>Montant</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className={styles.dateCell}>{dateLabel(entry.entry_date)}</td>
                        <td>
                          <div className={styles.entryTitle}>
                            <strong>{entry.label}</strong>
                            {entry.notes && <span>{entry.notes}</span>}
                          </div>
                        </td>
                        <td><span className={styles.categoryBadge}>{entry.category || "Général"}</span></td>
                        <td>
                          <span className={`${styles.typePill} ${entry.entry_type === "income" ? styles.incomePill : styles.expensePill}`}>
                            {entry.entry_type === "income" ? "Recette" : "Dépense"}
                          </span>
                        </td>
                        <td className={`${styles.amountColumn} ${entry.entry_type === "income" ? styles.positive : styles.negative}`}>
                          {entry.entry_type === "income" ? "+" : "−"}{currency(Number(entry.amount))}
                        </td>
                        <td>
                          <form action={deleteAccountingEntry}>
                            <input type="hidden" name="id" value={entry.id} />
                            <button className={styles.deleteButton} type="submit" aria-label={`Supprimer ${entry.label}`} title="Supprimer l’écriture">×</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <aside className={`${styles.panel} ${styles.entryPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.eyebrow}>SAISIE</span>
                <h2>Nouvelle écriture</h2>
                <p>Ajoute manuellement une recette ou une dépense.</p>
              </div>
            </div>

            <form action={createAccountingEntry} className={styles.entryForm} autoComplete="off">
              <fieldset className={styles.typeSelector}>
                <legend>Nature du mouvement</legend>
                <label>
                  <input type="radio" name="operation_type" value="income" defaultChecked />
                  <span><b>Recette</b><small>Entrée d’argent</small></span>
                </label>
                <label>
                  <input type="radio" name="operation_type" value="expense" />
                  <span><b>Dépense</b><small>Sortie d’argent</small></span>
                </label>
              </fieldset>

              <div className={styles.formRow}>
                <label>
                  <span>Date</span>
                  <input type="date" name="operation_date" defaultValue={today} required />
                </label>
                <label>
                  <span>Catégorie</span>
                  <input name="operation_category" list="accounting-categories" placeholder="Nostra Motors…" />
                </label>
              </div>

              <datalist id="accounting-categories">
                <option value="Nostra Motors" />
                <option value="Nostra Circuit" />
                <option value="Événement" />
                <option value="Entretien" />
                <option value="Achat véhicule" />
                <option value="Frais de fonctionnement" />
              </datalist>

              <label>
                <span>Libellé</span>
                <input name="operation_label" placeholder="Exemple : vente Porsche 911" required />
              </label>

              <label>
                <span>Montant</span>
                <div className={styles.amountInput}>
                  <input type="text" inputMode="decimal" name="operation_amount" placeholder="300 000" required />
                  <b>€</b>
                </div>
              </label>

              <label>
                <span>Note facultative</span>
                <textarea name="operation_notes" rows={3} placeholder="Client, facture ou information complémentaire" />
              </label>

              <button className={styles.submitButton} type="submit">Enregistrer l’écriture</button>
              <p className={styles.formNotice}>Les montants 50000, 50 000 et 50.000 sont acceptés.</p>
            </form>
          </aside>
        </section>

        <section className={styles.categorySection}>
          <div className={styles.sectionTitle}>
            <div>
              <span className={styles.eyebrow}>VENTILATION</span>
              <h2>Performance par activité</h2>
            </div>
            <p>Lecture des volumes et du solde généré par chaque catégorie comptable.</p>
          </div>

          {categoryRows.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>Aucune catégorie à analyser</strong>
            </div>
          ) : (
            <div className={styles.categoryGrid}>
              {categoryRows.map((row) => (
                <article className={styles.categoryCard} key={row.category}>
                  <div className={styles.categoryTopline}>
                    <div>
                      <strong>{row.category}</strong>
                      <span>{row.count} écriture(s)</span>
                    </div>
                    <b className={row.balance >= 0 ? styles.positive : styles.negative}>
                      {signedCurrency(row.balance)}
                    </b>
                  </div>
                  <div className={styles.progressTrack} aria-hidden="true">
                    <span style={{ width: `${Math.max(3, (row.volume / categoryMaximum) * 100)}%` }} />
                  </div>
                  <dl>
                    <div><dt>Recettes</dt><dd>{currency(row.income)}</dd></div>
                    <div><dt>Dépenses</dt><dd>{currency(row.expenses)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
