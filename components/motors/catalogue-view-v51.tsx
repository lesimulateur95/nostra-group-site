/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import { CatalogueComparatorEnhancer } from "@/components/motors/catalogue-comparator-enhancer";
import {
  CATALOG_LABELS,
  CATALOG_PATHS,
  CATALOG_TYPES,
  type CatalogType,
  getCataloguesV51Configured,
  getCatalogVehiclesV51,
} from "@/lib/catalogues-v51/data";
import {
  getStockCommerceConfigured,
} from "@/lib/backoffice/data";
import {
  getSitePage,
  type EditablePageSlug,
} from "@/lib/content/site-content";

import styles from "./catalogue-v51.module.css";

function formatPrice(value: number): string {
  return Number(value).toLocaleString(
    "fr-FR",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  );
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

  const [
    configured,
    vehicles,
    stockConfigured,
    customPage,
  ] = await Promise.all([
    getCataloguesV51Configured(),
    getCatalogVehiclesV51({
      catalogType,
    }),
    getStockCommerceConfigured(),
    sitePageSlug
      ? getSitePage(sitePageSlug)
      : Promise.resolve(null),
  ]);

  const grouped = new Map<
    string,
    typeof vehicles
  >();

  for (const vehicle of vehicles) {
    const current =
      grouped.get(vehicle.brand) ?? [];

    current.push(vehicle);
    grouped.set(vehicle.brand, current);
  }

  return (
    <article className="motors-catalogue-page">
      <header className="document-hero">
        <p className="eyebrow">
          NOSTRA MOTORS
        </p>

        <h1 className="page-title">
          {customPage?.title || title}
        </h1>

        <p className="lead">{description}</p>
      </header>

      <nav
        className={styles.tabs}
        aria-label="Catalogues Nostra Motors"
      >
        {CATALOG_TYPES.map((type) => (
          <Link
            className={
              type === catalogType
                ? styles.activeTab
                : styles.tab
            }
            href={CATALOG_PATHS[type]}
            key={type}
          >
            {CATALOG_LABELS[type]}
          </Link>
        ))}
      </nav>

      {customPage?.content?.trim() && (
        <section className="catalogue-intro editable-document-copy">
          {customPage.content}
        </section>
      )}

      {params.cart_added && (
        <div className="catalogue-feedback catalogue-feedback-success">
          Le véhicule a bien été ajouté à ton panier.{" "}
          <Link href="/profil">
            Voir mon panier
          </Link>
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
          <p>
            Exécute le SQL V51 pour activer les trois catalogues séparés.
          </p>
        </section>
      )}

      {configured &&
        vehicles.length === 0 && (
          <section className="catalogue-empty">
            <h2>
              Aucun véhicule dans ce catalogue
            </h2>
            <p>
              La Direction choisit depuis le Dashboard quels véhicules apparaissent ici.
            </p>
          </section>
        )}

      {configured &&
        vehicles.length > 0 && (
          <>
            <nav
              className="catalogue-brand-nav"
              aria-label="Marques du catalogue"
            >
              {[...grouped.keys()].map(
                (brand) => (
                  <a
                    href={`#${brandAnchor(
                      brand,
                    )}`}
                    key={brand}
                  >
                    {brand}
                  </a>
                ),
              )}
            </nav>

            <div className="catalogue-brand-sections">
              {[...grouped.entries()].map(
                ([
                  brand,
                  brandVehicles,
                ]) => (
                  <section
                    className="catalogue-brand-section"
                    id={brandAnchor(brand)}
                    key={brand}
                  >
                    <div className="catalogue-brand-heading">
                      <p className="eyebrow">
                        MARQUE
                      </p>
                      <h2>{brand}</h2>
                      <span>
                        {brandVehicles.length} véhicule
                        {brandVehicles.length > 1
                          ? "s"
                          : ""}
                      </span>
                    </div>

                    <div className="catalogue-vehicle-grid">
                      {brandVehicles.map(
                        (vehicle) => (
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
                                {vehicle.images
                                  .slice(1)
                                  .map(
                                    (
                                      image,
                                      index,
                                    ) => (
                                      <img
                                        src={image.url}
                                        alt={`${vehicle.brand} ${vehicle.model} — vue ${index + 2}`}
                                        loading="lazy"
                                        key={image.path}
                                      />
                                    ),
                                  )}
                              </div>
                            )}

                            <div className="catalogue-vehicle-copy">
                              <p className="eyebrow">
                                {vehicle.brand}
                              </p>

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
                                    {vehicle.trunk_capacity ||
                                      "Non renseigné"}
                                  </dd>
                                </div>

                                <div>
                                  <dt>Vitesse</dt>
                                  <dd>
                                    {vehicle.top_speed ||
                                      "Non renseignée"}
                                  </dd>
                                </div>

                                <div>
                                  <dt>Puissance</dt>
                                  <dd>
                                    {vehicle.power ||
                                      "Non renseignée"}
                                  </dd>
                                </div>

                                <div className="catalogue-price">
                                  <dt>Prix</dt>
                                  <dd>
                                    {formatPrice(
                                      vehicle.price,
                                    )}
                                  </dd>
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
                                {vehicle.stock_quantity > 0 &&
                                stockConfigured ? (
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
                              </div>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  </section>
                ),
              )}
            </div>
          </>
        )}

      <CatalogueComparatorEnhancer />
    </article>
  );
}
