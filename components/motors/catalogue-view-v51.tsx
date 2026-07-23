/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  CatalogueComparatorPanelV51,
  CatalogueComparatorProviderV51,
  CatalogueCompareButtonV51,
} from "@/components/motors/catalogue-comparator-v51";
import { VehicleFavoriteControls } from "@/components/motors/vehicle-favorite-controls";
import {
  CATALOG_LABELS,
  CATALOG_PATHS,
  CATALOG_TYPES,
  type CatalogType,
  getCataloguesV51Configured,
  getCatalogVehiclesV51,
} from "@/lib/catalogues-v51/data";
import { getStockCommerceConfigured } from "@/lib/backoffice/data";
import { getCurrentFavoriteStateMap } from "@/lib/favorites/data";
import {
  getSitePage,
  type EditablePageSlug,
} from "@/lib/content/site-content";
import styles from "./catalogue-v51.module.css";

function formatPrice(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function brandAnchor(brand: string): string {
  return `marque-${brand
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export async function CatalogueViewV51({
  catalogType,
  title,
  description,
  searchParams,
  sitePageSlug,
}: {
  catalogType: CatalogType;
  title: string;
  description: string;
  searchParams: Promise<{
    cart_added?: string;
    cart_error?: string;
  }>;
  sitePageSlug?: EditablePageSlug;
}) {
  const params = await searchParams;
  const [configured, vehicles, stockConfigured, customPage] =
    await Promise.all([
      getCataloguesV51Configured(),
      getCatalogVehiclesV51({ catalogType }),
      getStockCommerceConfigured(),
      sitePageSlug ? getSitePage(sitePageSlug) : Promise.resolve(null),
    ]);

  const favoriteState = await getCurrentFavoriteStateMap(
    vehicles.map((vehicle) => Number(vehicle.id)),
  );

  const grouped = new Map<string, typeof vehicles>();
  for (const vehicle of vehicles) {
    const current = grouped.get(vehicle.brand) ?? [];
    current.push(vehicle);
    grouped.set(vehicle.brand, current);
  }

  return (
    <CatalogueComparatorProviderV51
      key={catalogType}
      catalogType={catalogType}
    >
      <article className="motors-catalogue-page">
        <header className="document-hero">
          <p className="eyebrow">NOSTRA MOTORS</p>
          <h1 className="page-title">{customPage?.title || title}</h1>
          <p className="lead">{description}</p>
        </header>

        <nav className={styles.tabs} aria-label="Catalogues Nostra Motors">
          {CATALOG_TYPES.map((type) => (
            <Link
              className={type === catalogType ? styles.activeTab : styles.tab}
              href={CATALOG_PATHS[type]}
              key={type}
              prefetch={false}
            >
              {CATALOG_LABELS[type]}
            </Link>
          ))}
        </nav>

        <CatalogueComparatorPanelV51 title={CATALOG_LABELS[catalogType]} />

        {customPage?.content?.trim() && (
          <section className="catalogue-intro editable-document-copy">
            {customPage.content}
          </section>
        )}

        {params.cart_added && (
          <div className="catalogue-feedback catalogue-feedback-success">
            Le véhicule a bien été ajouté à ton panier. {" "}
            <Link href="/profil">Voir mon panier</Link>
          </div>
        )}

        {params.cart_error && (
          <div className="catalogue-feedback catalogue-feedback-error">
            {params.cart_error === "stock"
              ? "Ce véhicule n’est plus disponible dans cette quantité."
              : params.cart_error === "setup"
                ? "La liaison entre le catalogue et le stock doit encore être activée."
                : "Impossible d’ajouter ce véhicule au panier."}
          </div>
        )}

        {!configured && (
          <section className="catalogue-empty">
            <h2>Activation nécessaire</h2>
            <p>Exécute le SQL V51 pour activer les trois catalogues séparés.</p>
          </section>
        )}

        {configured && vehicles.length === 0 && (
          <section className="catalogue-empty">
            <h2>Aucun véhicule dans ce catalogue</h2>
            <p>
              La Direction choisit depuis le Dashboard quels véhicules
              apparaissent ici.
            </p>
          </section>
        )}

        {configured && vehicles.length > 0 && (
          <>
            <nav
              className="catalogue-brand-nav"
              aria-label="Marques du catalogue"
            >
              {[...grouped.keys()].map((brand) => (
                <a href={`#${brandAnchor(brand)}`} key={brand}>
                  {brand}
                </a>
              ))}
            </nav>

            <div className="catalogue-brand-sections">
              {[...grouped.entries()].map(([brand, brandVehicles]) => (
                <section
                  className="catalogue-brand-section"
                  id={brandAnchor(brand)}
                  key={brand}
                >
                  <div className="catalogue-brand-heading">
                    <p className="eyebrow">MARQUE</p>
                    <h2>{brand}</h2>
                    <span>
                      {brandVehicles.length} véhicule
                      {brandVehicles.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="catalogue-vehicle-grid">
                    {brandVehicles.map((vehicle) => {
                      const formattedPrice = formatPrice(vehicle.price);

                      return (
                        <article
                          className="catalogue-vehicle-card"
                          key={vehicle.id}
                        >
                          <div className="catalogue-vehicle-media">
                            {vehicle.images[0] ? (
                              <img
                                src={vehicle.images[0].url}
                                alt={`${vehicle.brand} ${vehicle.model}`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="catalogue-photo-placeholder">
                                PHOTO À VENIR
                              </div>
                            )}
                          </div>

                          {vehicle.images.length > 1 && (
                            <div className="catalogue-photo-strip">
                              {vehicle.images.slice(1).map((image, index) => (
                                <img
                                  src={image.url}
                                  alt={`${vehicle.brand} ${vehicle.model} — vue ${index + 2}`}
                                  loading="lazy"
                                  key={image.path}
                                />
                              ))}
                            </div>
                          )}

                          <div className="catalogue-vehicle-copy">
                            <p className="eyebrow">{vehicle.brand}</p>
                            <h3>{vehicle.model}</h3>

                            {vehicle.description && (
                              <p className="catalogue-description">
                                {vehicle.description}
                              </p>
                            )}

                            <dl className="catalogue-spec-grid">
                              <div>
                                <dt>Coffre</dt>
                                <dd>
                                  {vehicle.trunk_capacity || "Non renseigné"}
                                </dd>
                              </div>
                              <div>
                                <dt>Vitesse</dt>
                                <dd>
                                  {vehicle.top_speed || "Non renseignée"}
                                </dd>
                              </div>
                              <div>
                                <dt>Puissance</dt>
                                <dd>{vehicle.power || "Non renseignée"}</dd>
                              </div>
                              <div className="catalogue-price">
                                <dt>Prix</dt>
                                <dd>{formattedPrice}</dd>
                              </div>
                            </dl>

                            <div
                              className={`catalogue-stock-status${
                                vehicle.stock_quantity <= 0
                                  ? " catalogue-stock-status-empty"
                                  : ""
                              }`}
                            >
                              <span>
                                {vehicle.stock_quantity > 0
                                  ? "Disponible"
                                  : "Rupture de stock"}
                              </span>
                              <strong>
                                {stockConfigured
                                  ? `${vehicle.stock_quantity} en stock`
                                  : "Stock en cours d’activation"}
                              </strong>
                            </div>

                            <div className="catalogue-cart-form">
                              {vehicle.stock_quantity > 0 && stockConfigured ? (
                                <Link
                                  className="btn catalogue-cart-button"
                                  href={`/motors/catalogue/${vehicle.id}/commande`}
                                >
                                  Ajouter au panier
                                </Link>
                              ) : (
                                <button
                                  className="btn catalogue-cart-button"
                                  type="button"
                                  disabled
                                >
                                  Indisponible
                                </button>
                              )}

                              <CatalogueCompareButtonV51
                                vehicle={{
                                  id: String(vehicle.id),
                                  label: `${vehicle.brand} ${vehicle.model}`,
                                  price: formattedPrice,
                                  imageUrl: vehicle.images[0]?.url ?? null,
                                  notes: [
                                    vehicle.trunk_capacity
                                      ? `Coffre : ${vehicle.trunk_capacity}`
                                      : "Coffre non renseigné",
                                    vehicle.top_speed
                                      ? `Vitesse : ${vehicle.top_speed}`
                                      : "Vitesse non renseignée",
                                    vehicle.power
                                      ? `Puissance : ${vehicle.power}`
                                      : "Puissance non renseignée",
                                  ],
                                }}
                              />

                              <VehicleFavoriteControls
                                vehicleId={Number(vehicle.id)}
                                stockQuantity={vehicle.stock_quantity}
                                initialFavorite={
                                  favoriteState.get(Number(vehicle.id))?.favorite ??
                                  false
                                }
                                initialAlert={
                                  favoriteState.get(Number(vehicle.id))
                                    ?.stockAlert ?? false
                                }
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </article>
    </CatalogueComparatorProviderV51>
  );
}
