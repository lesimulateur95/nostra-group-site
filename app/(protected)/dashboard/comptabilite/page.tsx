import { createAccountingEntry, deleteAccountingEntry } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAccountingEntries } from "@/lib/backoffice/data";

function euros(value: number) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function AccountingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const entries = await getAccountingEntries();
  const income = entries.filter((entry) => entry.entry_type === "income").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expenses = entries.filter((entry) => entry.entry_type === "expense").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <DashboardShell>
      <DashboardHeader title="Comptabilité" description="Enregistre les recettes et dépenses de Nostra Group. Le solde se calcule automatiquement à partir des opérations saisies." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">L’opération a été enregistrée.</div>}
      {params.deleted && <div className="dashboard-feedback">L’opération a été supprimée.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Vérifie les informations saisies.</div>}

      <section className="dashboard-kpi-grid">
        <article><span>Total des recettes</span><strong className="positive-number">{euros(income)}</strong></article>
        <article><span>Total des dépenses</span><strong className="negative-number">{euros(expenses)}</strong></article>
        <article><span>Solde</span><strong>{euros(income - expenses)}</strong></article>
        <article><span>Opérations enregistrées</span><strong>{entries.length}</strong></article>
      </section>

      <section className="dashboard-two-columns">
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">＋</span><div><h2>Nouvelle opération</h2><p>Ajoute une recette ou une dépense.</p></div></div>
          <form action={createAccountingEntry} className="backoffice-form">
            <label>Date<input type="date" name="entry_date" defaultValue={today} required /></label>
            <label>Type<select name="entry_type" defaultValue="income"><option value="income">Recette</option><option value="expense">Dépense</option></select></label>
            <label>Catégorie<input name="category" placeholder="Vente, circuit, entretien…" /></label>
            <label>Libellé<input name="label" placeholder="Exemple : réservation circuit" required /></label>
            <label>Montant (€)<input type="number" name="amount" min="0.01" step="0.01" required /></label>
            <label className="form-span-2">Note<textarea name="notes" rows={4} placeholder="Information complémentaire" /></label>
            <button className="btn" type="submit">Enregistrer l’opération</button>
          </form>
        </article>

        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">€</span><div><h2>Dernières opérations</h2><p>Les 100 opérations les plus récentes.</p></div></div>
          <div className="backoffice-list">
            {entries.length === 0 && <p className="empty-state">Aucune opération enregistrée.</p>}
            {entries.map((entry) => (
              <div className="transaction-row" key={entry.id}>
                <div>
                  <strong>{entry.label}</strong>
                  <span>{new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString("fr-FR")} · {entry.category}</span>
                </div>
                <strong className={entry.entry_type === "income" ? "positive-number" : "negative-number"}>
                  {entry.entry_type === "income" ? "+" : "−"}{euros(Number(entry.amount))}
                </strong>
                <form action={deleteAccountingEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="icon-delete" type="submit" aria-label="Supprimer">×</button>
                </form>
              </div>
            ))}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
