/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  CatalogueComparatorPanelV51,
  CatalogueComparatorProviderV51,
  CatalogueCompareButtonV51,
} from "@/components/motors/catalogue-comparator-v51";
import { CatalogueFiltersV114 } from "@/components/motors/catalogue-filters-v114";
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
import { getVehicleCommerceAvailabilityMap } from "@/lib/vehicle-commerce-settings/data";
import { isVehicleReservationEnabled } from "@/lib/vehicle-reservation-settings/data";
import { getFlashSaleMapV156 } from "@/lib/v156/data";
import {
  canCitizenAccessVehicleTierV157,
  getActiveVehicleSaleV157,
  getCurrentCitizenVehicleTierV157,
  getVehicleMerchandisingMapV157,
  vehicleAccessTierLabelV157,
  vehicleTierBadgeClassV157,
} from "@/lib/v157/data";
import { createClient } from "@/lib/supabase/server";
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


function usedStatusLabel(status: string): string {
  if (status === "reserved") return "Réservé";
  if (status === "sold") return "Vendu";
  return "Disponible";
}

function usedConditionLabel(value: string): string {
  const labels: Record<string, string> = {
    excellent: "Excellent état",
    very_good: "Très bon état",
    good: "Bon état",
    fair: "État correct",
    repair: "À remettre en état",
  };

  return labels[value] ?? value;
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
    reservationsEnabled,
  ] = await Promise.all([
    getCataloguesV51Configured(),
    getCatalogVehiclesV51({ catalogType }),
    getStockCommerceConfigured(),
    sitePageSlug ? getSitePage(sitePageSlug) : Promise.resolve(null),
    isVehicleReservationEnabled(catalogType),
  ]);

  const vehicleIds = vehicles.map((vehicle) => Number(vehicle.id));
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [favoriteState, commerceAvailability, flashSales, merchandising, citizenTier] = await Promise.all([
    getCurrentFavoriteStateMap(vehicleIds),
    getVehicleCommerceAvailabilityMap(vehicleIds),
    getFlashSaleMapV156(vehicleIds),
    getVehicleMerchandisingMapV157(vehicleIds),
    getCurrentCitizenVehicleTierV157(authData.user?.id),
  ]);

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

        {!reservationsEnabled && (
          <section className="catalogue-reservation-closed-v98">
            <div>
              <span className="eyebrow">RÉSERVATIONS TEMPORAIREMENT FERMÉES</span>
              <h2>Les commandes autorisées restent disponibles</h2>
              <p>
                La réservation avec un acompte de 15 % est désactivée pour ce
                catalogue. Les véhicules dont la vente est autorisée peuvent toujours être commandés au prix total.
              </p>
            </div>
          </section>
        )}

        {catalogType === "used" && (
          <section className="catalogue-trade-in-callout-v96">
            <div>
              <span className="eyebrow">REPRISE NOSTRA MOTORS</span>
              <h2>Tu souhaites vendre ton véhicule ?</h2>
              <p>
                Envoie ses informations et ses photos afin de recevoir une
                estimation de rachat directement dans ton espace personnel.
              </p>
            </div>
            <Link href="/motors/reprise" className="btn">
              Faire reprendre mon véhicule
            </Link>
          </section>
        )}

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
            <p>Exécute le SQL V151 pour activer les cinq catalogues séparés.</p>
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
            <CatalogueFiltersV114 brands={[...grouped.keys()]} />

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

            <div className="catalogue-brand-sections" data-catalogue-results-v114>
              {[...grouped.entries()].map(([brand, brandVehicles]) => (
                <section
                  className="catalogue-brand-section"
                  id={brandAnchor(brand)}
                  key={brand}
                  data-catalogue-brand-section-v114
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
                    {brandVehicles.map((vehicle, vehicleIndex) => {
                      const vehicleMerchandising = merchandising.get(Number(vehicle.id));
                      const regularSale = catalogType === "concession"
                        ? null
                        : getActiveVehicleSaleV157(vehicleMerchandising, vehicle.price);
                      const flashSale = catalogType === "concession" ? null : flashSales.get(Number(vehicle.id));
                      const flashPrice = flashSale?.flashPrice ?? null;
                      const effectivePrice = Math.min(
                        regularSale?.salePrice ?? vehicle.price,
                        flashPrice ?? vehicle.price,
                      );
                      const regularSaleIsEffective = Boolean(
                        regularSale && regularSale.salePrice <= (flashPrice ?? Number.POSITIVE_INFINITY),
                      );
                      const formattedPrice = formatPrice(effectivePrice);
                      const requiredTier = vehicleMerchandising?.requiredTier ?? "all";
                      const tierAllowed = canCitizenAccessVehicleTierV157(requiredTier, citizenTier);
                      const requiredTierLabel = vehicleAccessTierLabelV157(requiredTier);
                      const availability = commerceAvailability.get(
                        Number(vehicle.id),
                      ) ?? {
                        vehicle_id: Number(vehicle.id),
                        reservation_enabled: true,
                        sale_enabled: true,
                      };
                      const canReserve =
                        reservationsEnabled && availability.reservation_enabled && !regularSale && !flashSale;
                      const canOrder = availability.sale_enabled;
                      const canStartPurchase = (canReserve || canOrder) && tierAllowed;
                      const purchaseLabel = !tierAllowed
                        ? `Réservé ${requiredTierLabel}`
                        : catalogType === "concession"
                        ? canOrder
                          ? "Louer"
                          : "Temporairement indisponible"
                        : canReserve && canOrder
                          ? "Réserver / Commander"
                          : canReserve
                            ? "Réserver"
                            : canOrder
                              ? "Commander"
                              : "Temporairement indisponible";

                      return (
                        <article
                          className="catalogue-vehicle-card"
                          key={vehicle.id}
                          data-catalogue-card-v114
                          data-brand={vehicle.brand.toLocaleLowerCase("fr-FR")}
                          data-search={`${vehicle.brand} ${vehicle.model}`.toLocaleLowerCase("fr-FR")}
                          data-price={Number(effectivePrice)}
                          data-stock={Number(vehicle.stock_quantity)}
                          data-reserve={canReserve ? "true" : "false"}
                          data-sale={canOrder ? "true" : "false"}
                          data-status={catalogType === "used" ? (vehicle.used_vehicle_status || "available") : "available"}
                          data-order={vehicleIndex}
                        >
                          <div className="catalogue-vehicle-media">
                            {(regularSaleIsEffective || requiredTier !== "all") && (
                              <div className="catalogue-badge-stack-v157">
                                {regularSaleIsEffective && regularSale && (
                                  <span className="catalogue-sale-badge-v157">
                                    <span className="catalogue-badge-icon-v158" aria-hidden="true">
                                      <svg viewBox="0 0 24 24" focusable="false"><path d="M3 12.2V5.4C3 4.07 4.07 3 5.4 3h6.8c.64 0 1.25.25 1.7.7l6.4 6.4a2.4 2.4 0 0 1 0 3.4l-6.8 6.8a2.4 2.4 0 0 1-3.4 0L3.7 13.9a2.4 2.4 0 0 1-.7-1.7Zm5.1-5.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z"/></svg>
                                    </span>
                                    <span>SOLDES -{regularSale.discountPercent}%</span>
                                  </span>
                                )}
                                {requiredTier !== "all" && (
                                  <span className={`catalogue-tier-badge-v157 ${vehicleTierBadgeClassV157(requiredTier)}`}>
                                    <span className="catalogue-badge-icon-v158" aria-hidden="true">
                                      <svg viewBox="0 0 24 24" focusable="false"><path d="m3.2 7.1 4.2 3.2L12 4l4.6 6.3 4.2-3.2-1.8 9.7H5L3.2 7.1Zm2.4 11.2h12.8v2H5.6v-2Z"/></svg>
                                    </span>
                                    <span>{requiredTierLabel.toUpperCase()}</span>
                                  </span>
                                )}
                              </div>
                            )}
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
                            {flashSale && !regularSaleIsEffective && (
                              <div className="catalogue-flash-sale-v156">
                                <strong>VENTE FLASH</strong>
                                <span>jusqu’au {new Date(flashSale.endsAt).toLocaleString("fr-FR")}</span>
                              </div>
                            )}

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
                                <dt>{catalogType === "used" ? "État" : "Puissance"}</dt>
                                <dd>
                                  {catalogType === "used"
                                    ? usedConditionLabel(vehicle.used_condition) || "Contrôlé"
                                    : vehicle.power || "Non renseignée"}
                                </dd>
                              </div>
                              <div className="catalogue-price">
                                <dt>Prix</dt>
                                <dd>
                                  {effectivePrice < vehicle.price ? (
                                    <span className="catalogue-sale-price-wrap-v158">
                                      <span className="catalogue-old-price-v158">{formatPrice(vehicle.price)}</span>
                                      <strong className="catalogue-new-price-v158">{formattedPrice}</strong>
                                    </span>
                                  ) : formattedPrice}
                                </dd>
                              </div>
                            </dl>

                            <div
                              className={`catalogue-stock-status${
                                vehicle.stock_quantity <= 0 ||
                                (catalogType === "used" &&
                                  vehicle.used_vehicle_status !== "available")
                                  ? " catalogue-stock-status-empty"
                                  : ""
                              }`}
                            >
                              <span>
                                {catalogType === "used"
                                  ? usedStatusLabel(vehicle.used_vehicle_status)
                                  : vehicle.stock_quantity > 0
                                    ? "Disponible"
                                    : "Rupture de stock"}
                              </span>
                              <strong>
                                {stockConfigured
                                  ? catalogType === "used"
                                    ? vehicle.used_vehicle_status === "available"
                                      ? `${vehicle.stock_quantity} disponible${vehicle.stock_quantity > 1 ? "s" : ""}`
                                      : usedStatusLabel(vehicle.used_vehicle_status)
                                    : `${vehicle.stock_quantity} en stock`
                                  : "Stock en cours d’activation"}
                              </strong>
                            </div>

                            <div className="catalogue-commerce-status-v99">
                              {!availability.reservation_enabled && (
                                <span>Réservation suspendue</span>
                              )}
                              {!availability.sale_enabled && (
                                <span>Vente suspendue</span>
                              )}
                              {availability.reservation_enabled &&
                                !reservationsEnabled && (
                                  <span>Réservations du catalogue fermées</span>
                                )}
                            </div>

                            <div className="catalogue-cart-form">
                              {vehicle.stock_quantity > 0 &&
                              stockConfigured &&
                              canStartPurchase &&
                              (catalogType !== "used" ||
                                vehicle.used_vehicle_status === "available") ? (
                                <Link
                                  className="btn catalogue-cart-button"
                                  href={`/motors/catalogue/${vehicle.id}/commande`}
                                >
                                  {purchaseLabel}
                                </Link>
                              ) : (
                                <button
                                  className="btn catalogue-cart-button"
                                  type="button"
                                  disabled
                                >
                                  {vehicle.stock_quantity <= 0 ||
                                  (catalogType === "used" &&
                                    vehicle.used_vehicle_status !== "available")
                                    ? "Indisponible"
                                    : purchaseLabel}
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
                                    catalogType === "used"
                                      ? `État : ${usedConditionLabel(vehicle.used_condition) || "Contrôlé"}`
                                      : vehicle.power
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
            <section className="catalogue-empty" data-catalogue-no-results-v114 hidden>
              <h2>Aucun véhicule ne correspond aux filtres</h2>
              <p>Réinitialise les filtres ou élargis la recherche.</p>
            </section>
          </>
        )}
      </article>
    </CatalogueComparatorProviderV51>
  );
}
