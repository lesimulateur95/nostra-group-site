import { updateCatalogVehicleStock } from "@/app/actions/catalogue";
import { deleteInventoryItem, saveInventoryItem } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCatalogVehicles, getInventoryItems, getStockCommerceConfigured } from "@/lib/backoffice/data";
import { STOCK_ORDERS_SETUP_SQL } from "@/lib/backoffice/stock-orders-setup-sql";

export default async function StocksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [items, stockConfigured, vehicles] = await Promise.all([
    getInventoryItems(),
    getStockCommerceConfigured(),
    getCatalogVehicles(true),
  ]);
  const vehicleAlerts = stockConfigured ? vehicles.filter((vehicle) => vehicle.stock_quantity <= 0) : [];
  const totalValue = items.reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0)
    + (stockConfigured ? vehicles.reduce((sum, vehicle) => sum + vehicle.stock_quantity * Number(vehicle.price), 0) : 0);

  return (
    <DashboardShell>
      <DashboardHeader title="Gestion des stocks" description="Le stock des véhicules est relié au catalogue, aux paniers et aux commandes. Les autres articles restent gérés séparément ci-dessous." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le stock de l’article a été mis à jour.</div>}
      {params.vehicle_saved && <div className="dashboard-feedback dashboard-feedback-success">La quantité du véhicule a été mise à jour dans le catalogue.</div>}
      {params.deleted && <div className="dashboard-feedback">L’article a été supprimé.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">{params.error === "stock-setup" ? "Active d’abord le module V22 avec le code SQL ci-dessous." : "Impossible d’enregistrer cet article."}</div>}

      {!stockConfigured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation V22 nécessaire</span>
          <h2>Relier les véhicules du catalogue au stock</h2>
          <p>Après activation, chaque véhicule du catalogue apparaîtra ici avec sa quantité. Une commande retirera automatiquement le stock et une annulation le remettra.</p>
          <details open><summary>Afficher le code SQL V22 à copier dans Supabase</summary><pre>{STOCK_ORDERS_SETUP_SQL}</pre></details>
          <ol>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle le code et clique sur <strong>Run query</strong>.</li>
            <li>Reviens ici et fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      )}

      <section className="dashboard-kpi-grid">
        <article><span>Véhicules catalogue</span><strong>{vehicles.length}</strong></article>
        <article><span>Véhicules disponibles</span><strong>{stockConfigured ? vehicles.reduce((sum, vehicle) => sum + vehicle.stock_quantity, 0) : "—"}</strong></article>
        <article><span>Alertes véhicule</span><strong className={vehicleAlerts.length ? "negative-number" : "positive-number"}>{stockConfigured ? vehicleAlerts.length : "—"}</strong></article>
        <article><span>Valeur estimée totale</span><strong>{totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</strong></article>
      </section>

      {stockConfigured && (
        <section className="vehicle-stock-section">
          <div className="dashboard-section-heading dashboard-section-heading-tight">
            <p className="eyebrow">NOSTRA MOTORS</p>
            <h2>Stock des véhicules du catalogue</h2>
            <p>Les véhicules sont créés et publiés depuis « Catalogue Nostra Motors ». Ici, tu modifies uniquement leur quantité disponible.</p>
          </div>
          <div className="vehicle-stock-grid">
            {vehicles.length === 0 && <div className="backoffice-panel empty-state">Ajoute d’abord un véhicule dans Dashboard → Catalogue Nostra Motors.</div>}
            {vehicles.map((vehicle) => (
              <article className={`vehicle-stock-card${vehicle.stock_quantity <= 0 ? " vehicle-stock-card-empty" : ""}`} key={vehicle.id}>
                <div className="vehicle-stock-card-head">
                  <div><span>{vehicle.brand}</span><h3>{vehicle.model}</h3></div>
                  <span className={`stock-pill${vehicle.stock_quantity <= 0 ? " stock-pill-alert" : ""}`}>{vehicle.stock_quantity <= 0 ? "Rupture" : "Disponible"}</span>
                </div>
                <p>{vehicle.published ? "Visible dans le catalogue" : "Masqué du catalogue"} · {Number(vehicle.price).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                <form action={updateCatalogVehicleStock} className="vehicle-stock-form">
                  <input type="hidden" name="id" value={vehicle.id} />
                  <label>Quantité en stock<input type="number" name="stock_quantity" min="0" defaultValue={vehicle.stock_quantity} required /></label>
                  <button className="btn" type="submit">Enregistrer la quantité</button>
                </form>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="dashboard-section-heading stock-secondary-heading">
        <p className="eyebrow">AUTRES ARTICLES</p>
        <h2>Pièces, équipements et consommables</h2>
      </div>

      <article className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">＋</span><div><h2>Ajouter un article</h2><p>Crée une référence qui n’est pas un véhicule du catalogue.</p></div></div>
        <form action={saveInventoryItem} className="backoffice-form backoffice-form-wide">
          <label>Nom<input name="name" required placeholder="Exemple : pneu compétition" /></label>
          <label>Catégorie<input name="category" placeholder="Pièces, équipement…" /></label>
          <label>Référence / SKU<input name="sku" placeholder="Optionnel" /></label>
          <label>Quantité<input type="number" name="quantity" min="0" defaultValue="0" required /></label>
          <label>Seuil d’alerte<input type="number" name="minimum_quantity" min="0" defaultValue="0" required /></label>
          <label>Prix unitaire (€)<input type="number" name="unit_price" min="0" step="0.01" defaultValue="0" required /></label>
          <label className="form-span-3">Note<textarea name="notes" rows={3} /></label>
          <button className="btn" type="submit">Ajouter au stock</button>
        </form>
      </article>

      <section className="inventory-grid">
        {items.length === 0 && <div className="backoffice-panel empty-state">Aucun autre article dans le stock.</div>}
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
