/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  CatalogueComparatorPanelV51,
  CatalogueComparatorProviderV51,
  CatalogueCompareButtonV51,
} from "@/components/motors/catalogue-comparator-v51";
import { CatalogueFiltersV114 } from "@/components/motors/catalogue-filters-v114";
import {
  CatalogueCollectionSelectionButtonV1601,
  CatalogueSelectionButtonV1601,
  CatalogueSelectionProviderV1601,
} from "@/components/motors/catalogue-selection-v1601";
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
  getExclusiveCollectionsV158,
  type ExclusiveCollectionV158,
} from "@/lib/v158/exclusive-collections";
import {
  getExclusiveCatalogueVehiclesV159,
  getVehicleCollectionMapV159,
} from "@/lib/v159/collection-memberships";
import { getMyDeliveryAddressesV161, getVehicleHoldCountsV161 } from "@/lib/nostra-motors/v161-data";
import { applyCampaignPriceV162, campaignMatchesVehicleV162, getCampaignsV162 } from "@/lib/v162/data";
import v162Styles from "@/components/v162/v162.module.css";
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
    collection_error?: string;
    selection_error?: string;
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
    exclusiveCollections,
    campaignsV162,
  ] = await Promise.all([
    getCataloguesV51Configured(),
    catalogType === "exclusive"
      ? getExclusiveCatalogueVehiclesV159()
      : getCatalogVehiclesV51({ catalogType }),
    getStockCommerceConfigured(),
    sitePageSlug ? getSitePage(sitePageSlug) : Promise.resolve(null),
    isVehicleReservationEnabled(catalogType),
    catalogType === "exclusive"
      ? getExclusiveCollectionsV158()
      : Promise.resolve<ExclusiveCollectionV158[]>([]),
    getCampaignsV162(),
  ]);

  const vehicleIds = vehicles.map((vehicle) => Number(vehicle.id));
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authMetadata = (authData.user?.user_metadata ?? {}) as Record<string, unknown>;
  const profilePhone = typeof authMetadata.phone === "string" ? authMetadata.phone : "";
  const profileAddress = typeof authMetadata.address === "string" ? authMetadata.address : "";
  const deliveryAddressesV161 = authData.user
    ? await getMyDeliveryAddressesV161(authData.user.id)
    : [];
  const [favoriteState, commerceAvailability, flashSales, merchandising, citizenTier, collectionMap, holdCountsV161] = await Promise.all([
    getCurrentFavoriteStateMap(vehicleIds),
    getVehicleCommerceAvailabilityMap(vehicleIds),
    getFlashSaleMapV156(vehicleIds),
    getVehicleMerchandisingMapV157(vehicleIds),
    getCurrentCitizenVehicleTierV157(authData.user?.id),
    getVehicleCollectionMapV159(vehicleIds),
    getVehicleHoldCountsV161(vehicleIds),
  ]);

  const campaignOfferV162 = (vehicle: (typeof vehicles)[number], basePrice: number) => {
    const collectionIds = (collectionMap.get(Number(vehicle.id)) ?? []).map((item) => item.id);
    const matching = campaignsV162.filter((campaign) =>
      campaignMatchesVehicleV162(campaign, vehicle, collectionIds),
    );
    return { matching, ...applyCampaignPriceV162(basePrice, matching) };
  };

  const grouped = new Map<string, typeof vehicles>();
  for (const vehicle of vehicles) {
    const current = grouped.get(vehicle.brand) ?? [];
    current.push(vehicle);
    grouped.set(vehicle.brand, current);
  }

  const collectionGroups = exclusiveCollections.map((collection) => {
    const collectionVehicles = vehicles.filter(
      (vehicle) => (collectionMap.get(Number(vehicle.id)) ?? []).some((item) => item.id === collection.id),
    );
    let total = 0;
    let bundleReady = collectionVehicles.length > 0;
    for (const vehicle of collectionVehicles) {
      const vehicleMerchandising = merchandising.get(Number(vehicle.id));
      const regularSale = getActiveVehicleSaleV157(vehicleMerchandising, vehicle.price);
      const flashSale = flashSales.get(Number(vehicle.id));
      const campaignOffer = campaignOfferV162(vehicle, vehicle.price);
      const effectivePrice = Math.min(
        regularSale?.salePrice ?? vehicle.price,
        flashSale?.flashPrice ?? vehicle.price,
        campaignOffer.price,
      );
      total += effectivePrice;
      const availability = commerceAvailability.get(Number(vehicle.id));
      const requiredTier = vehicleMerchandising?.requiredTier ?? "all";
      if (
        Math.max(0, Number(vehicle.stock_quantity) - (holdCountsV161.get(Number(vehicle.id)) ?? 0)) <= 0 ||
        availability?.sale_enabled === false ||
        !canCitizenAccessVehicleTierV157(requiredTier, citizenTier)
      ) {
        bundleReady = false;
      }
    }
    return { collection, vehicles: collectionVehicles, total, bundleReady };
  }).filter((entry) => entry.vehicles.length > 0);

  return (
    <CatalogueComparatorProviderV51
      key={catalogType}
      catalogType={catalogType}
    >
      <CatalogueSelectionProviderV1601
        profilePhone={profilePhone}
        profileAddress={profileAddress}
        deliveryAddresses={deliveryAddressesV161}
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

        {params.selection_error && (
          <div className="catalogue-feedback catalogue-feedback-error">
            {params.selection_error === "empty"
              ? "Ta sélection est vide."
              : params.selection_error === "stock"
                ? "Au moins un véhicule sélectionné n’est plus disponible en stock."
                : params.selection_error === "sale"
                  ? "La vente d’au moins un véhicule sélectionné est actuellement suspendue."
                  : params.selection_error === "tier"
                    ? "Ton grade de fidélité ne permet pas l’achat de tous les véhicules sélectionnés."
                    : params.selection_error === "vip"
                      ? "Une vente privée de ta sélection nécessite un niveau VIP supérieur."
                      : params.selection_error === "rental"
                        ? "Les véhicules du catalogue Location ne peuvent pas entrer dans une commande groupée."
                        : params.selection_error === "held"
                          ? "Au moins un véhicule vient d’être temporairement réservé par un autre citoyen."
                        : params.selection_error === "limit"
                          ? "Tu as atteint le nombre maximal de véhicules pouvant être réservés temporairement dans un panier."
                        : params.selection_error === "address"
                          ? "Renseigne une adresse complète pour la livraison à domicile."
                          : params.selection_error === "phone"
                            ? "Renseigne un numéro de téléphone pour la livraison à domicile."
                            : params.selection_error === "setup"
                              ? "Exécute le SQL V161 avant d’utiliser la réservation temporaire du stock."
                              : "Impossible de préparer cette sélection. Vérifie la disponibilité des véhicules."}
          </div>
        )}

        {catalogType === "exclusive" && params.collection_error && (
          <div className="catalogue-feedback catalogue-feedback-error">
            {params.collection_error === "stock"
              ? "La collection complète ne peut pas être ajoutée : au moins un véhicule est en rupture de stock."
              : params.collection_error === "tier"
                ? "Ton niveau fidélité ne permet pas encore l’achat de tous les véhicules de cette collection."
                : params.collection_error === "vip"
                  ? "Une vente privée de cette collection nécessite un niveau VIP supérieur."
                  : params.collection_error === "sale"
                    ? "La vente d’au moins un véhicule de cette collection est actuellement suspendue."
                    : params.collection_error === "empty"
                      ? "Cette collection ne contient actuellement aucun véhicule achetable."
                      : "Impossible d’ajouter la collection complète au panier."}
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
            {catalogType === "exclusive" && collectionGroups.length > 0 && (
              <section className={styles.collectionShowcaseV158}>
                <div className={styles.collectionShowcaseHeadingV158}>
                  <div>
                    <span>COLLECTIONS NOSTRA</span>
                    <h2>Acheter véhicule par véhicule ou la collection entière</h2>
                    <p>Chaque collection peut regrouper des véhicules venant de plusieurs catalogues, sans dupliquer leurs fiches. La sélection groupée permet de choisir toute la collection, puis de définir une seule fois le mode de récupération avant le panier.</p>
                  </div>
                </div>
                <div className={styles.collectionGridV158}>
                  {collectionGroups.map(({ collection, vehicles: collectionVehicles, total, bundleReady }) => (
                    <article className={styles.collectionCardV158} key={collection.id}>
                      <div>
                        <span className={styles.collectionLabelV158}>COLLECTION</span>
                        <h3>{collection.name}</h3>
                        {collection.description && <p>{collection.description}</p>}
                      </div>
                      <div className={styles.collectionMetaV158}>
                        <span>{collectionVehicles.length} véhicule{collectionVehicles.length > 1 ? "s" : ""}</span>
                        <strong>{formatPrice(total)}</strong>
                      </div>
                      <CatalogueCollectionSelectionButtonV1601
                        disabled={!bundleReady}
                        items={collectionVehicles.map((vehicle) => {
                          const vehicleMerchandising = merchandising.get(Number(vehicle.id));
                          const regularSale = getActiveVehicleSaleV157(vehicleMerchandising, vehicle.price);
                          const flashPrice = flashSales.get(Number(vehicle.id))?.flashPrice ?? null;
                          const campaignOffer = campaignOfferV162(vehicle, vehicle.price);
                          const effectivePrice = Math.min(
                            regularSale?.salePrice ?? vehicle.price,
                            flashPrice ?? vehicle.price,
                            campaignOffer.price,
                          );
                          return {
                            id: Number(vehicle.id),
                            label: `${vehicle.brand} ${vehicle.model}`,
                            price: effectivePrice,
                            imageUrl: vehicle.images[0]?.url ?? null,
                            catalogType: vehicle.catalog_type,
                          };
                        })}
                      />
                    </article>
                  ))}
                </div>
              </section>
            )}

            <CatalogueFiltersV114
              brands={[...grouped.keys()]}
              collections={catalogType === "exclusive" ? collectionGroups.map(({ collection }) => ({ slug: collection.slug, name: collection.name })) : []}
            />

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
                      const campaignOffer = campaignOfferV162(vehicle, vehicle.price);
                      const effectivePrice = Math.min(
                        regularSale?.salePrice ?? vehicle.price,
                        flashPrice ?? vehicle.price,
                        campaignOffer.price,
                      );
                      const campaignBadge = campaignOffer.matching[0] ?? null;
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
                      const temporarilyReserved = holdCountsV161.get(Number(vehicle.id)) ?? 0;
                      const availableAfterHolds = Math.max(0, Number(vehicle.stock_quantity) - temporarilyReserved);
                      const canStartPurchase = (canReserve || canOrder) && tierAllowed && availableAfterHolds > 0;
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
                          data-stock={availableAfterHolds}
                          data-reserve={canReserve ? "true" : "false"}
                          data-sale={canOrder ? "true" : "false"}
                          data-status={catalogType === "used" ? (vehicle.used_vehicle_status || "available") : "available"}
                          data-collection={(collectionMap.get(Number(vehicle.id)) ?? []).map((item) => item.slug).join("|")}
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
                            {catalogType === "exclusive" && (collectionMap.get(Number(vehicle.id)) ?? []).length > 0 && (
                              <span className={styles.collectionVehicleBadgeV158}>
                                {(collectionMap.get(Number(vehicle.id)) ?? []).map((item) => item.name).join(" · ")}
                              </span>
                            )}
                            {vehicle.is_demo && (
                              <span className={styles.demoVehicleBadgeV164}>VÉHICULE DE DÉMONSTRATION</span>
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
                            {vehicle.is_demo && (
                              <div className={styles.demoInfoV164}>
                                <div>
                                  <strong>Démonstration Nostra</strong>
                                  <span>{vehicle.demo_mileage.toLocaleString("fr-FR")} km</span>
                                </div>
                                {vehicle.demo_original_price != null && vehicle.demo_original_price > vehicle.price && (
                                  <div>
                                    <span>Prix neuf</span>
                                    <strong className={styles.demoOldPriceV164}>{formatPrice(vehicle.demo_original_price)}</strong>
                                  </div>
                                )}
                                {vehicle.demo_note && <p>{vehicle.demo_note}</p>}
                              </div>
                            )}
                            {campaignBadge && (
                              <div className={v162Styles.campaignBanner}>
                                <div>
                                  <span className={v162Styles.campaignBadge}>{campaignBadge.badgeText}</span>
                                  {campaignBadge.description && <p>{campaignBadge.description}</p>}
                                </div>
                                {campaignOffer.freeDelivery && <strong>LIVRAISON OFFERTE</strong>}
                              </div>
                            )}
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
                                availableAfterHolds <= 0 ||
                                (catalogType === "used" &&
                                  vehicle.used_vehicle_status !== "available")
                                  ? " catalogue-stock-status-empty"
                                  : ""
                              }`}
                            >
                              <span>
                                {catalogType === "used"
                                  ? usedStatusLabel(vehicle.used_vehicle_status)
                                  : availableAfterHolds > 0
                                    ? "Disponible"
                                    : temporarilyReserved > 0
                                      ? "Réservation temporaire en cours"
                                      : "Rupture de stock"}
                              </span>
                              <strong>
                                {stockConfigured
                                  ? catalogType === "used"
                                    ? vehicle.used_vehicle_status === "available"
                                      ? `${vehicle.stock_quantity} disponible${vehicle.stock_quantity > 1 ? "s" : ""}`
                                      : usedStatusLabel(vehicle.used_vehicle_status)
                                    : temporarilyReserved > 0
                                      ? `${availableAfterHolds} disponible${availableAfterHolds > 1 ? "s" : ""} · ${temporarilyReserved} réservé${temporarilyReserved > 1 ? "s" : ""} temporairement`
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
                              {availableAfterHolds > 0 &&
                              stockConfigured &&
                              canStartPurchase &&
                              (catalogType !== "used" ||
                                vehicle.used_vehicle_status === "available") ? (
                                catalogType !== "concession" && canOrder ? (
                                  <CatalogueSelectionButtonV1601
                                    item={{
                                      id: Number(vehicle.id),
                                      label: `${vehicle.brand} ${vehicle.model}`,
                                      price: effectivePrice,
                                      imageUrl: vehicle.images[0]?.url ?? null,
                                      catalogType: vehicle.catalog_type,
                                    }}
                                    optionsHref={`/motors/catalogue/${vehicle.id}/commande`}
                                  />
                                ) : (
                                  <Link
                                    className="btn catalogue-cart-button"
                                    href={`/motors/catalogue/${vehicle.id}/commande`}
                                  >
                                    {purchaseLabel}
                                  </Link>
                                )
                              ) : (
                                <button
                                  className="btn catalogue-cart-button"
                                  type="button"
                                  disabled
                                >
                                  {availableAfterHolds <= 0 ||
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
      </CatalogueSelectionProviderV1601>
    </CatalogueComparatorProviderV51>
  );
}
