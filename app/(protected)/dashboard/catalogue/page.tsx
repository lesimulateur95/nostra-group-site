/* eslint-disable @next/next/no-img-element */
import { deleteCatalogVehicle, saveCatalogVehicle } from "@/app/actions/catalogue";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCatalogModuleConfigured, getCatalogVehicles, getStockCommerceConfigured } from "@/lib/backoffice/data";
import { BACKOFFICE_SETUP_SQL } from "@/lib/backoffice/setup-sql";
import { STOCK_ORDERS_SETUP_SQL } from "@/lib/backoffice/stock-orders-setup-sql";

function errorMessage(code: string | undefined): string {
  if (code === "invalid") return "Vérifie la marque, le modèle et le prix.";
  if (code === "image-type") return "Les photos doivent être au format JPG, PNG ou WEBP.";
  if (code === "image-size") return "Chaque photo doit peser moins de 5 Mo.";
  if (code === "too-many") return "Un véhicule peut contenir au maximum 6 photos.";
  if (code === "upload") return "Impossible d’envoyer une ou plusieurs photos.";
  if (code === "delete") return "Impossible de supprimer ce véhicule.";
  if (code === "not-found") return "Ce véhicule n’existe plus.";
  if (code === "stock-setup") return "Active d’abord la liaison stock, panier et commandes avec le script SQL V22 affiché ci-dessous.";
  return "Impossible d’enregistrer ce véhicule.";
}

export default async function DashboardCataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const configured = await getCatalogModuleConfigured();
  const stockConfigured = configured ? await getStockCommerceConfigured() : false;
  const vehicles = configured ? await getCatalogVehicles(true) : [];
  const brands = [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <DashboardShell>
      <DashboardHeader
        title="Catalogue Nostra Motors"
        description="Ajoute les véhicules par marque, leurs photos, leurs performances et leur prix. Les changements apparaissent directement dans le catalogue public."
      />

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Le véhicule a été enregistré dans le catalogue.</div>}
      {params.deleted && <div className="dashboard-feedback">Le véhicule, ses photos et toutes ses lignes présentes dans les paniers ont été supprimés.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">{errorMessage(params.error)}</div>}

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer le catalogue avec photos</h2>
          <p>Supabase doit créer la table des véhicules et l’espace de stockage des photos une seule fois.</p>
          <details>
            <summary>Afficher le code SQL à copier dans Supabase</summary>
            <pre>{BACKOFFICE_SETUP_SQL}</pre>
          </details>
          <ol>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle tout le code et clique sur <strong>Run query</strong>.</li>
            <li>Reviens ici et fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      ) : !stockConfigured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation V22 nécessaire</span>
          <h2>Relier le catalogue, les stocks, les paniers et les commandes</h2>
          <p>Ce script ajoute la quantité disponible, retire le stock lors d’une commande, le remet lors d’une annulation et nettoie les paniers lors de la suppression d’un véhicule.</p>
          <details open>
            <summary>Afficher le code SQL V22 à copier dans Supabase</summary>
            <pre>{STOCK_ORDERS_SETUP_SQL}</pre>
          </details>
          <ol>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle tout le code et clique sur <strong>Run query</strong>.</li>
            <li>Reviens ici et fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      ) : (
        <>
          <section className="dashboard-kpi-grid">
            <article><span>Véhicules</span><strong>{vehicles.length}</strong></article>
            <article><span>Marques</span><strong>{brands.length}</strong></article>
            <article><span>Publiés</span><strong>{vehicles.filter((vehicle) => vehicle.published).length}</strong></article>
            <article><span>Stock total</span><strong>{vehicles.reduce((total, vehicle) => total + vehicle.stock_quantity, 0)}</strong></article>
          </section>

          <article className="backoffice-panel catalog-admin-create">
            <div className="panel-heading">
              <span className="panel-icon">🚗</span>
              <div><h2>Ajouter un véhicule</h2><p>Tu peux envoyer jusqu’à 6 photos par véhicule.</p></div>
            </div>
            <form action={saveCatalogVehicle} className="backoffice-form backoffice-form-wide" encType="multipart/form-data">
              <label>Marque<input name="brand" required list="catalog-brands" placeholder="Exemple : Ferrari" /></label>
              <label>Modèle<input name="model" required placeholder="Exemple : 488 Pista" /></label>
              <label>Prix (€)<input name="price" inputMode="decimal" required placeholder="Exemple : 580000" /></label>
              <label>Quantité en stock<input type="number" name="stock_quantity" min="0" defaultValue="0" required /></label>
              <label>Coffre<input name="trunk_capacity" placeholder="Exemple : 230 L" /></label>
              <label>Vitesse maximale<input name="top_speed" placeholder="Exemple : 340 km/h" /></label>
              <label>Puissance<input name="power" placeholder="Exemple : 720 ch" /></label>
              <label>Ordre d’affichage<input type="number" min="0" name="sort_order" defaultValue="0" /></label>
              <label className="form-span-2">Photos<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple /></label>
              <label className="form-span-3">Description<textarea name="description" rows={4} placeholder="Informations complémentaires sur le véhicule…" /></label>
              <label className="checkbox-label"><input type="checkbox" name="published" defaultChecked /> Publier immédiatement</label>
              <button className="btn" type="submit">Ajouter au catalogue</button>
            </form>
            <datalist id="catalog-brands">{brands.map((brand) => <option value={brand} key={brand} />)}</datalist>
          </article>

          <section className="catalog-admin-list">
            {vehicles.length === 0 && <div className="backoffice-panel empty-state">Aucun véhicule dans le catalogue.</div>}
            {vehicles.map((vehicle) => (
              <article className="catalog-admin-card" key={vehicle.id}>
                <div className="catalog-admin-card-head">
                  <div>
                    <span>{vehicle.brand}</span>
                    <h2>{vehicle.model}</h2>
                  </div>
                  <div className="catalog-admin-badges">
                    <span className={`catalog-stock-pill${vehicle.stock_quantity <= 0 ? " catalog-stock-pill-empty" : ""}`}>
                      Stock : {vehicle.stock_quantity}
                    </span>
                    <span className={`catalog-publish-pill${vehicle.published ? "" : " catalog-publish-pill-hidden"}`}>
                      {vehicle.published ? "Publié" : "Masqué"}
                    </span>
                  </div>
                </div>

                {vehicle.images.length > 0 && (
                  <div className="catalog-admin-images">
                    {vehicle.images.map((image, index) => (
                      <label className="catalog-admin-image" key={image.path}>
                        <img src={image.url} alt={`${vehicle.brand} ${vehicle.model} — photo ${index + 1}`} loading="lazy" />
                        <span><input type="checkbox" name="remove_images" value={image.path} form={`vehicle-form-${vehicle.id}`} /> Supprimer cette photo</span>
                      </label>
                    ))}
                  </div>
                )}

                <form id={`vehicle-form-${vehicle.id}`} action={saveCatalogVehicle} className="backoffice-form backoffice-form-wide" encType="multipart/form-data">
                  <input type="hidden" name="id" value={vehicle.id} />
                  <label>Marque<input name="brand" required defaultValue={vehicle.brand} list="catalog-brands" /></label>
                  <label>Modèle<input name="model" required defaultValue={vehicle.model} /></label>
                  <label>Prix (€)<input name="price" inputMode="decimal" required defaultValue={Number(vehicle.price)} /></label>
                  <label>Quantité en stock<input type="number" name="stock_quantity" min="0" required defaultValue={vehicle.stock_quantity} /></label>
                  <label>Coffre<input name="trunk_capacity" defaultValue={vehicle.trunk_capacity} /></label>
                  <label>Vitesse maximale<input name="top_speed" defaultValue={vehicle.top_speed} /></label>
                  <label>Puissance<input name="power" defaultValue={vehicle.power} /></label>
                  <label>Ordre d’affichage<input type="number" min="0" name="sort_order" defaultValue={vehicle.sort_order} /></label>
                  <label className="form-span-2">Ajouter d’autres photos<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple /></label>
                  <label className="form-span-3">Description<textarea name="description" rows={4} defaultValue={vehicle.description} /></label>
                  <label className="checkbox-label"><input type="checkbox" name="published" defaultChecked={vehicle.published} /> Visible dans le catalogue</label>
                  <button className="btn" type="submit">Enregistrer le véhicule</button>
                </form>

                <form action={deleteCatalogVehicle} className="danger-form">
                  <input type="hidden" name="id" value={vehicle.id} />
                  <button type="submit">Supprimer définitivement le véhicule</button>
                </form>
              </article>
            ))}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
