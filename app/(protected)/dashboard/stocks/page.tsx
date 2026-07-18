import { deleteInventoryItem, saveInventoryItem } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getInventoryItems } from "@/lib/backoffice/data";

export default async function StocksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const items = await getInventoryItems();
  const alerts = items.filter((item) => item.quantity <= item.minimum_quantity);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0);

  return (
    <DashboardShell>
      <DashboardHeader title="Gestion des stocks" description="Ce stock est privé : il n’est modifiable que depuis le Dashboard Gérant." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le stock a été mis à jour.</div>}
      {params.deleted && <div className="dashboard-feedback">L’article a été supprimé.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer cet article.</div>}

      <section className="dashboard-kpi-grid">
        <article><span>Références</span><strong>{items.length}</strong></article>
        <article><span>Quantité totale</span><strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong></article>
        <article><span>Alertes de stock</span><strong className={alerts.length ? "negative-number" : "positive-number"}>{alerts.length}</strong></article>
        <article><span>Valeur estimée</span><strong>{totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</strong></article>
      </section>

      <article className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">＋</span><div><h2>Ajouter un article</h2><p>Crée une nouvelle référence dans le stock.</p></div></div>
        <form action={saveInventoryItem} className="backoffice-form backoffice-form-wide">
          <label>Nom<input name="name" required placeholder="Exemple : pneu compétition" /></label>
          <label>Catégorie<input name="category" placeholder="Pièces, véhicules, équipement…" /></label>
          <label>Référence / SKU<input name="sku" placeholder="Optionnel" /></label>
          <label>Quantité<input type="number" name="quantity" min="0" defaultValue="0" required /></label>
          <label>Seuil d’alerte<input type="number" name="minimum_quantity" min="0" defaultValue="0" required /></label>
          <label>Prix unitaire (€)<input type="number" name="unit_price" min="0" step="0.01" defaultValue="0" required /></label>
          <label className="form-span-3">Note<textarea name="notes" rows={3} /></label>
          <button className="btn" type="submit">Ajouter au stock</button>
        </form>
      </article>

      <section className="inventory-grid">
        {items.length === 0 && <div className="backoffice-panel empty-state">Aucun article dans le stock.</div>}
        {items.map((item) => {
          const low = item.quantity <= item.minimum_quantity;
          return (
            <article className={`inventory-card${low ? " inventory-card-alert" : ""}`} key={item.id}>
              <div className="inventory-card-head">
                <div><span>{item.category}</span><h3>{item.name}</h3></div>
                <span className={`stock-pill${low ? " stock-pill-alert" : ""}`}>{low ? "Stock faible" : "Disponible"}</span>
              </div>
              <form action={saveInventoryItem} className="inventory-edit-form">
                <input type="hidden" name="id" value={item.id} />
                <label>Nom<input name="name" defaultValue={item.name} required /></label>
                <label>Catégorie<input name="category" defaultValue={item.category} /></label>
                <label>Référence<input name="sku" defaultValue={item.sku ?? ""} /></label>
                <label>Quantité<input type="number" name="quantity" min="0" defaultValue={item.quantity} required /></label>
                <label>Seuil d’alerte<input type="number" name="minimum_quantity" min="0" defaultValue={item.minimum_quantity} required /></label>
                <label>Prix unitaire<input type="number" name="unit_price" min="0" step="0.01" defaultValue={Number(item.unit_price)} required /></label>
                <label className="form-span-2">Note<textarea name="notes" rows={3} defaultValue={item.notes ?? ""} /></label>
                <button className="btn" type="submit">Enregistrer</button>
              </form>
              <form action={deleteInventoryItem} className="danger-form">
                <input type="hidden" name="id" value={item.id} />
                <button type="submit">Supprimer l’article</button>
              </form>
            </article>
          );
        })}
      </section>
    </DashboardShell>
  );
}
