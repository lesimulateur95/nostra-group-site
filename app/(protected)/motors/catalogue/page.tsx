/* eslint-disable @next/next/no-img-element */
import { addCatalogVehicleToCart } from "@/app/actions/catalogue";
import { getCatalogModuleConfigured, getCatalogVehicles } from "@/lib/backoffice/data";
import { getSitePage } from "@/lib/content/site-content";

function formatPrice(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function brandAnchor(brand: string): string {
  return `marque-${brand.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

type CataloguePageProps = {
  searchParams: Promise<{ cart_added?: string; cart_error?: string }>;
};

export default async function CataloguePage({ searchParams }: CataloguePageProps) {
  const params = await searchParams;
  const [configured, vehicles, customPage] = await Promise.all([
    getCatalogModuleConfigured(),
    getCatalogVehicles(),
    getSitePage("motors-catalogue"),
  ]);

  const grouped = new Map<string, typeof vehicles>();
  for (const vehicle of vehicles) {
    const current = grouped.get(vehicle.brand) ?? [];
    current.push(vehicle);
    grouped.set(vehicle.brand, current);
  }

  return (
    <article className="motors-catalogue-page">
      <header className="document-hero">
        <p className="eyebrow">NOSTRA MOTORS</p>
        <h1 className="page-title">{customPage?.title || "Catalogue"}</h1>
        <p className="lead">Découvre les véhicules disponibles, classés directement par marque.</p>
      </header>

      {customPage?.content?.trim() && (
        <section className="catalogue-intro editable-document-copy">{customPage.content}</section>
      )}

      {params.cart_added && (
        <div className="catalogue-feedback catalogue-feedback-success">
          Le véhicule a bien été ajouté à ton panier. <a href="/profil">Voir mon panier</a>
        </div>
      )}

      {params.cart_error && (
        <div className="catalogue-feedback catalogue-feedback-error">
          Impossible d’ajouter ce véhicule au panier. Vérifie que ton espace client est bien activé, puis réessaie.
        </div>
      )}

      {!configured && (
        <section className="catalogue-empty">
          <h2>Catalogue en préparation</h2>
          <p>Le module catalogue doit encore être activé par la direction.</p>
        </section>
      )}

      {configured && vehicles.length === 0 && (
        <section className="catalogue-empty">
          <h2>Aucun véhicule publié</h2>
          <p>Les premiers modèles seront ajoutés prochainement par Nostra Motors.</p>
        </section>
      )}

      {vehicles.length > 0 && (
        <>
          <nav className="catalogue-brand-nav" aria-label="Marques du catalogue">
            {[...grouped.keys()].map((brand) => (
              <a href={`#${brandAnchor(brand)}`} key={brand}>{brand}</a>
            ))}
          </nav>

          <div className="catalogue-brand-sections">
            {[...grouped.entries()].map(([brand, brandVehicles]) => (
              <section className="catalogue-brand-section" id={brandAnchor(brand)} key={brand}>
                <div className="catalogue-brand-heading">
                  <p className="eyebrow">MARQUE</p>
                  <h2>{brand}</h2>
                  <span>{brandVehicles.length} véhicule{brandVehicles.length > 1 ? "s" : ""}</span>
                </div>

                <div className="catalogue-vehicle-grid">
                  {brandVehicles.map((vehicle) => (
                    <article className="catalogue-vehicle-card" key={vehicle.id}>
                      <div className="catalogue-vehicle-media">
                        {vehicle.images[0] ? (
                          <img src={vehicle.images[0].url} alt={`${vehicle.brand} ${vehicle.model}`} loading="lazy" />
                        ) : (
                          <div className="catalogue-photo-placeholder">PHOTO À VENIR</div>
                        )}
                      </div>

                      {vehicle.images.length > 1 && (
                        <div className="catalogue-photo-strip">
                          {vehicle.images.slice(1).map((image, index) => (
                            <img src={image.url} alt={`${vehicle.brand} ${vehicle.model} — vue ${index + 2}`} loading="lazy" key={image.path} />
                          ))}
                        </div>
                      )}

                      <div className="catalogue-vehicle-copy">
                        <p className="eyebrow">{vehicle.brand}</p>
                        <h3>{vehicle.model}</h3>
                        {vehicle.description && <p className="catalogue-description">{vehicle.description}</p>}

                        <dl className="catalogue-spec-grid">
                          <div><dt>Coffre</dt><dd>{vehicle.trunk_capacity || "Non renseigné"}</dd></div>
                          <div><dt>Vitesse</dt><dd>{vehicle.top_speed || "Non renseignée"}</dd></div>
                          <div><dt>Puissance</dt><dd>{vehicle.power || "Non renseignée"}</dd></div>
                          <div className="catalogue-price"><dt>Prix</dt><dd>{formatPrice(vehicle.price)}</dd></div>
                        </dl>

                        <form action={addCatalogVehicleToCart} className="catalogue-cart-form">
                          <input type="hidden" name="vehicle_id" value={vehicle.id} />
                          <button className="btn catalogue-cart-button" type="submit">Ajouter au panier</button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
