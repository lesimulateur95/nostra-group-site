/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteCatalogVehicleV51,
  saveCatalogVehicleV51,
} from "@/app/actions/catalogue-v51";
import { setVehicleCommerceAvailability } from "@/app/actions/vehicle-reservation-settings";
import { saveVehicleMerchandisingV157 } from "@/app/actions/v157";
import {
  createExclusiveCollectionV158,
  deleteExclusiveCollectionV158,
  updateExclusiveCollectionV158,
} from "@/app/actions/v158-exclusive-collections";
import {
  addExistingVehicleToCollectionV159,
  removeVehicleFromCollectionV159,
} from "@/app/actions/v159-collection-memberships";
import {
  DashboardHeader,
} from "@/components/dashboard/dashboard-header";
import {
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";
import { OptimizedImageInput } from "@/components/forms/optimized-image-input";
import { CatalogueAdminCreateFieldsV158 } from "@/components/motors/catalogue-admin-create-fields-v158";
import {
  CATALOG_LABELS,
  CATALOG_TYPES,
  getCatalogVehiclesV51,
  getCataloguesV51Configured,
  normalizeCatalogType,
  type CatalogType,
} from "@/lib/catalogues-v51/data";
import {
  getCatalogModuleConfigured,
  getStockCommerceConfigured,
} from "@/lib/backoffice/data";
import { getVehicleCommerceAvailabilityMap } from "@/lib/vehicle-commerce-settings/data";
import {
  getActiveVehicleSaleV157,
  getVehicleMerchandisingMapV157,
  vehicleAccessTierLabelV157,
  vehicleTierBadgeClassV157,
} from "@/lib/v157/data";
import { getExclusiveCollectionsV158 } from "@/lib/v158/exclusive-collections";
import { getVehicleCollectionMapV159 } from "@/lib/v159/collection-memberships";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { canMotorsV164, getMotorsEmployeeAccessV164 } from "@/lib/v164/data";

import styles from "@/components/motors/catalogue-v51.module.css";

function errorMessage(
  code: string | undefined,
): string {
  const messages: Record<
    string,
    string
  > = {
    invalid:
      "Vérifie les informations du véhicule.",
    "image-type":
      "Les photos doivent être au format JPG, PNG ou WEBP.",
    "image-size":
      "La photo optimisée est encore trop lourde. Sélectionne-la de nouveau.",
    "too-many":
      "Une seule photo est autorisée par véhicule.",
    upload:
      "Impossible d’envoyer une ou plusieurs photos.",
    delete:
      "Impossible de supprimer ce véhicule.",
    "not-found":
      "Ce véhicule n’existe plus.",
    save:
      "Impossible d’enregistrer le véhicule. Vérifie que le SQL V51 a bien été exécuté.",
    "collection-v158":
      "Le véhicule a été créé mais son ancien rattachement V158 a échoué.",
    "collection-v159":
      "Le véhicule a été créé mais son rattachement à la collection a échoué. Exécute le SQL V159 puis réessaie.",
  };

  return messages[code ?? ""] ??
    "Impossible d’effectuer cette action.";
}

export default async function DashboardCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    saved?: string;
    deleted?: string;
    error?: string;
    commerce_saved?: string;
    commerce_error?: string;
    v157_saved?: string;
    v157_error?: string;
    sort?: string;
    brand?: string;
    v158_saved?: string;
    v158_error?: string;
    v159_saved?: string;
    v159_error?: string;
    new_collection?: string;
    collection?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  const manager = roles.includes("manager");
  const access = await getMotorsEmployeeAccessV164(data.user.id, manager);
  const legacy = roles.some((role) => ["employee", "commercial"].includes(role));
  if (
    !manager &&
    !canMotorsV164(access, "catalogue_read", legacy) &&
    !canMotorsV164(access, "catalogue_manage", legacy)
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const [
    oldConfigured,
    stockConfigured,
    v51Configured,
  ] = await Promise.all([
    getCatalogModuleConfigured(),
    getStockCommerceConfigured(),
    getCataloguesV51Configured(),
  ]);

  const allVehicles =
    oldConfigured && v51Configured
      ? await getCatalogVehiclesV51({
          includeUnpublished: true,
        })
      : [];

  const managedTypes = CATALOG_TYPES.filter((type) => type !== "used");
  const managedVehicles = allVehicles.filter((vehicle) => vehicle.catalog_type !== "used");
  const [commerceAvailability, merchandising, exclusiveCollections, exclusiveCollectionMap] = await Promise.all([
    getVehicleCommerceAvailabilityMap(
      managedVehicles.map((vehicle) => Number(vehicle.id)),
    ),
    getVehicleMerchandisingMapV157(managedVehicles.map((vehicle) => Number(vehicle.id))),
    getExclusiveCollectionsV158({ includeInactive: true }),
    getVehicleCollectionMapV159(managedVehicles.map((vehicle) => Number(vehicle.id)), { includeInactive: true }),
  ]);

  const selectedType:
    | CatalogType
    | "all" =
    params.type === "all" || params.type === "used"
      ? "all"
      : normalizeCatalogType(
          params.type,
        );

  type CatalogueSortMode =
    | "brand_asc"
    | "brand_desc"
    | "price_asc"
    | "price_desc";

  const sortMode: CatalogueSortMode =
    params.sort === "brand_desc" ||
    params.sort === "price_asc" ||
    params.sort === "price_desc"
      ? params.sort
      : "brand_asc";

  const vehiclesInSelectedCatalogue =
    selectedType === "all"
      ? managedVehicles
      : selectedType === "exclusive"
        ? managedVehicles.filter(
            (vehicle) =>
              vehicle.catalog_type === "exclusive" ||
              (exclusiveCollectionMap.get(Number(vehicle.id)) ?? []).length > 0,
          )
        : managedVehicles.filter(
            (vehicle) => vehicle.catalog_type === selectedType,
          );

  const availableBrands = Array.from(
    new Set(
      vehiclesInSelectedCatalogue
        .map((vehicle) => vehicle.brand.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) =>
    a.localeCompare(b, "fr", { sensitivity: "base", numeric: true }),
  );

  const selectedBrand =
    typeof params.brand === "string" &&
    availableBrands.some(
      (brand) => brand.localeCompare(params.brand ?? "", "fr", { sensitivity: "base" }) === 0,
    )
      ? availableBrands.find(
          (brand) => brand.localeCompare(params.brand ?? "", "fr", { sensitivity: "base" }) === 0,
        ) ?? "all"
      : "all";

  const buildCatalogueHref = (
    nextType: CatalogType | "all",
    nextSort = sortMode,
    nextBrand = selectedBrand,
  ) => {
    const query = new URLSearchParams();
    query.set("type", nextType);
    query.set("sort", nextSort);
    if (nextBrand !== "all") query.set("brand", nextBrand);
    return `/dashboard/catalogue?${query.toString()}`;
  };

  const visibleVehicles = vehiclesInSelectedCatalogue
    .filter(
      (vehicle) =>
        selectedBrand === "all" ||
        vehicle.brand.localeCompare(selectedBrand, "fr", { sensitivity: "base" }) === 0,
    )
    .slice()
    .sort((a, b) => {
    const brandDifference = a.brand.localeCompare(b.brand, "fr", {
      sensitivity: "base",
      numeric: true,
    });
    const modelDifference = a.model.localeCompare(b.model, "fr", {
      sensitivity: "base",
      numeric: true,
    });
    const priceDifference = a.price - b.price;

    if (sortMode === "brand_asc") {
      // Toutes les marques restent regroupées. À l’intérieur d’une marque,
      // les véhicules sont classés du moins cher au plus cher.
      if (brandDifference !== 0) return brandDifference;
      if (priceDifference !== 0) return priceDifference;
      if (modelDifference !== 0) return modelDifference;
    }

    if (sortMode === "brand_desc") {
      if (brandDifference !== 0) return -brandDifference;
      if (priceDifference !== 0) return priceDifference;
      if (modelDifference !== 0) return modelDifference;
    }

    if (sortMode === "price_asc") {
      if (priceDifference !== 0) return priceDifference;
      if (brandDifference !== 0) return brandDifference;
      if (modelDifference !== 0) return modelDifference;
    }

    if (sortMode === "price_desc") {
      if (priceDifference !== 0) return -priceDifference;
      if (brandDifference !== 0) return brandDifference;
      if (modelDifference !== 0) return modelDifference;
    }

    const orderDifference = a.sort_order - b.sort_order;
    if (orderDifference !== 0) return orderDifference;

    return a.id - b.id;
  });

  const createType:
    CatalogType =
    selectedType === "all"
      ? "standard"
      : selectedType;

  const defaultCreateCollectionId =
    createType === "exclusive" &&
    typeof params.new_collection === "string" &&
    exclusiveCollections.some((collection) => collection.id === params.new_collection && collection.active)
      ? params.new_collection
      : "";

  return (
    <DashboardShell>
      <DashboardHeader
        title="Catalogue Nostra Motors"
        description="Chaque véhicule garde un catalogue principal, mais peut aussi être présent dans une ou plusieurs collections sans dupliquer sa fiche."
      />

      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Le véhicule a été enregistré dans le catalogue sélectionné.
        </div>
      )}

      {params.deleted && (
        <div className="dashboard-feedback">
          Le véhicule a été supprimé.
        </div>
      )}

      {params.commerce_saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La réservation et la vente du véhicule ont bien été mises à jour.
        </div>
      )}

      {params.commerce_error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.commerce_error === "setup-v99"
            ? "Exécute le SQL V127 dans Supabase avant d’utiliser le blocage par véhicule."
            : params.commerce_error === "forbidden"
              ? "Seule la Direction peut modifier la vente d’un véhicule."
              : "Impossible de modifier la disponibilité commerciale de ce véhicule."}
        </div>
      )}

      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {errorMessage(params.error)}
        </div>
      )}

      {params.v157_saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Soldes et accès fidélité du véhicule enregistrés.
        </div>
      )}

      {params.v157_error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.v157_error === "sale"
            ? "Vérifie la remise ou le prix soldé."
            : params.v157_error === "dates"
              ? "La date de fin des soldes doit être postérieure à la date de début."
              : params.v157_error === "vehicle"
                ? "Ce véhicule n’existe plus."
                : "Impossible d’enregistrer les soldes ou l’accès fidélité. Exécute le SQL V157 si nécessaire."}
        </div>
      )}

      {params.v158_saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          {params.v158_saved === "assignment"
            ? "Collection du véhicule mise à jour."
            : params.v158_saved === "collection-deleted"
              ? "La collection a été supprimée. Les véhicules restent dans le catalogue exclusif."
              : "Collection exclusive enregistrée."}
        </div>
      )}

      {params.v158_error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.v158_error === "collection-name"
            ? "Donne un nom valide à la collection."
            : "Impossible de gérer les collections exclusives. Exécute le SQL V158 si nécessaire."}
        </div>
      )}

      {params.v159_saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          {params.v159_saved === "vehicle-removed"
            ? "Le véhicule a été retiré de la collection. Sa fiche et son catalogue principal restent inchangés."
            : "Le véhicule existant a été ajouté à la collection sans dupliquer sa fiche."}
        </div>
      )}

      {params.v159_error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.v159_error === "vehicle"
            ? "Ce véhicule ne peut pas être ajouté à cette collection."
            : params.v159_error === "collection"
              ? "Cette collection n’existe plus."
              : "Impossible de modifier les véhicules de la collection. Exécute le SQL V159 dans Supabase."}
        </div>
      )}

      {!oldConfigured ||
      !stockConfigured ||
      !v51Configured ? (
        <section className="dashboard-setup">
          <span className="module-status">
            Activation nécessaire
          </span>
          <h2>
            Activer les catalogues séparés
          </h2>
          <p>
            Exécute le fichier SQL V92 puis recharge la page.
          </p>
        </section>
      ) : (
        <>
          <nav
            className={styles.adminTabs}
            aria-label="Catalogues à gérer"
          >
            <Link
              className={
                selectedType === "all"
                  ? styles.activeAdminTab
                  : styles.adminTab
              }
              href={buildCatalogueHref("all", sortMode, "all")}
            >
              Tous · {managedVehicles.length}
            </Link>

            {managedTypes.map((type) => (
              <Link
                className={
                  selectedType === type
                    ? styles.activeAdminTab
                    : styles.adminTab
                }
                href={buildCatalogueHref(type, sortMode, "all")}
                key={type}
              >
                {CATALOG_LABELS[type]} ·{" "}
                {type === "exclusive"
                  ? managedVehicles.filter(
                      (vehicle) =>
                        vehicle.catalog_type === "exclusive" ||
                        (exclusiveCollectionMap.get(Number(vehicle.id)) ?? []).length > 0,
                    ).length
                  : managedVehicles.filter(
                      (vehicle) => vehicle.catalog_type === type,
                    ).length}
              </Link>
            ))}

            <Link className={styles.adminTab} href="/dashboard/occasion/rachats">
              Véhicules d’occasion →
            </Link>
          </nav>

          <section className="backoffice-panel" style={{ marginTop: 14, marginBottom: 18 }}>
            <div className="panel-heading" style={{ marginBottom: 12 }}>
              <span className="panel-icon">⌕</span>
              <div>
                <h2 style={{ marginBottom: 2 }}>Filtrer par marque</h2>
                <p>Affiche uniquement les véhicules de la marque choisie, sans changer leur catalogue.</p>
              </div>
            </div>

            <nav className={styles.adminTabs} aria-label="Filtre des véhicules par marque">
              <Link
                className={selectedBrand === "all" ? styles.activeAdminTab : styles.adminTab}
                href={buildCatalogueHref(selectedType, sortMode, "all")}
              >
                Toutes les marques · {vehiclesInSelectedCatalogue.length}
              </Link>

              {availableBrands.map((brand) => {
                const brandCount = vehiclesInSelectedCatalogue.filter(
                  (vehicle) =>
                    vehicle.brand.localeCompare(brand, "fr", { sensitivity: "base" }) === 0,
                ).length;

                return (
                  <Link
                    className={selectedBrand === brand ? styles.activeAdminTab : styles.adminTab}
                    href={buildCatalogueHref(selectedType, sortMode, brand)}
                    key={brand}
                  >
                    {brand} · {brandCount}
                  </Link>
                );
              })}
            </nav>
          </section>

          <section className="backoffice-panel" style={{ marginTop: 14, marginBottom: 18 }}>
            <div className="panel-heading" style={{ marginBottom: 12 }}>
              <span className="panel-icon">↕</span>
              <div>
                <h2 style={{ marginBottom: 2 }}>Trier les véhicules</h2>
                <p>Le tri s’applique immédiatement à la grille du Dashboard.</p>
              </div>
            </div>

            <nav className={styles.adminTabs} aria-label="Tri des véhicules du catalogue">
              <Link
                className={sortMode === "brand_asc" ? styles.activeAdminTab : styles.adminTab}
                href={buildCatalogueHref(selectedType, "brand_asc")}
              >
                Marque A → Z
              </Link>
              <Link
                className={sortMode === "brand_desc" ? styles.activeAdminTab : styles.adminTab}
                href={buildCatalogueHref(selectedType, "brand_desc")}
              >
                Marque Z → A
              </Link>
              <Link
                className={sortMode === "price_asc" ? styles.activeAdminTab : styles.adminTab}
                href={buildCatalogueHref(selectedType, "price_asc")}
              >
                Prix croissant
              </Link>
              <Link
                className={sortMode === "price_desc" ? styles.activeAdminTab : styles.adminTab}
                href={buildCatalogueHref(selectedType, "price_desc")}
              >
                Prix décroissant
              </Link>
            </nav>
          </section>

          {selectedType === "exclusive" && (
            <section className="backoffice-panel" style={{ marginTop: 14, marginBottom: 18 }}>
              <div className={styles.collectionSectionHeaderV1594}>
                <div className="panel-heading">
                  <span className="panel-icon">✦</span>
                  <div>
                    <h2>Collections du catalogue exclusif</h2>
                    <p>
                      Une collection peut contenir ses propres fiches et récupérer des véhicules des autres catalogues sans les dupliquer.
                    </p>
                  </div>
                </div>

                <details className={styles.collectionCreateV1594}>
                  <summary>
                    <span aria-hidden="true">＋</span>
                    Nouvelle collection
                  </summary>
                  <form action={createExclusiveCollectionV158} className={styles.collectionCreateFormV1594}>
                    <label>
                      Nom
                      <input name="name" required placeholder="Ex. Ferrari Iconic Collection" />
                    </label>
                    <label className={styles.collectionCreateOrderV1594}>
                      Ordre
                      <input type="number" name="sort_order" min="0" defaultValue="0" />
                    </label>
                    <label className={styles.collectionCreateDescriptionV1594}>
                      Description
                      <textarea name="description" rows={2} placeholder="Présentation courte visible côté citoyen." />
                    </label>
                    <button type="submit">Créer la collection</button>
                  </form>
                </details>
              </div>

              {exclusiveCollections.length > 0 ? (
                <div className={styles.collectionAccordionV1594}>
                  {exclusiveCollections.map((collection) => {
                    const collectionVehicles = managedVehicles.filter((vehicle) =>
                      (exclusiveCollectionMap.get(Number(vehicle.id)) ?? []).some((item) => item.id === collection.id),
                    );
                    const availableVehicles = managedVehicles.filter((vehicle) =>
                      !(exclusiveCollectionMap.get(Number(vehicle.id)) ?? []).some((item) => item.id === collection.id),
                    );
                    const availableVehiclesByCatalogue = managedTypes
                      .map((catalogType) => ({
                        catalogType,
                        label: CATALOG_LABELS[catalogType],
                        vehicles: availableVehicles
                          .filter((vehicle) => vehicle.catalog_type === catalogType)
                          .slice()
                          .sort((a, b) => {
                            const brand = a.brand.localeCompare(b.brand, "fr", { sensitivity: "base", numeric: true });
                            if (brand !== 0) return brand;
                            return a.model.localeCompare(b.model, "fr", { sensitivity: "base", numeric: true });
                          }),
                      }))
                      .filter((group) => group.vehicles.length > 0);

                    const shouldOpenCollection = params.collection === collection.id;

                    return (
                      <details
                        className={styles.collectionRowV1594}
                        id={`collection-${collection.id}`}
                        key={collection.id}
                        open={shouldOpenCollection}
                      >
                        <summary className={styles.collectionRowSummaryV1594}>
                          <div className={styles.collectionRowIdentityV1594}>
                            <span className={styles.collectionRowIconV1594} aria-hidden="true">✦</span>
                            <div>
                              <strong>{collection.name}</strong>
                              <small>
                                {collection.description?.trim() || "Aucune description"}
                              </small>
                            </div>
                          </div>

                          <div className={styles.collectionRowStatsV1594}>
                            <span className={collection.active ? styles.collectionVisibleV1594 : styles.collectionHiddenV1594}>
                              {collection.active ? "Visible" : "Masquée"}
                            </span>
                            <span className={styles.collectionVehicleCountV1594}>
                              {collectionVehicles.length} {collectionVehicles.length > 1 ? "véhicules" : "véhicule"}
                            </span>
                            <span className={styles.collectionChevronV1594} aria-hidden="true">⌄</span>
                          </div>
                        </summary>

                        <div className={styles.collectionRowBodyV1594}>
                          <div className={styles.collectionTopActionsV1594}>
                            <Link
                              href={`/dashboard/catalogue?type=exclusive&new_collection=${encodeURIComponent(collection.id)}#nouveau-vehicule`}
                              className={styles.collectionCreateVehicleV1594}
                            >
                              ＋ Créer une nouvelle fiche
                            </Link>

                            {availableVehicles.length > 0 ? (
                              <form action={addExistingVehicleToCollectionV159} className={styles.collectionInlineAddV1594}>
                                <input type="hidden" name="collection_id" value={collection.id} />
                                <select name="vehicle_id" required defaultValue="" aria-label={`Ajouter un véhicule à ${collection.name}`}>
                                  <option value="" disabled>Ajouter un véhicule existant…</option>
                                  {availableVehiclesByCatalogue.map((group) => (
                                    <optgroup label={group.label} key={group.catalogType}>
                                      {group.vehicles.map((vehicle) => (
                                        <option value={vehicle.id} key={vehicle.id}>
                                          {vehicle.brand} {vehicle.model}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                <button type="submit">Ajouter</button>
                              </form>
                            ) : (
                              <span className={styles.collectionAllAddedV1594}>Tous les véhicules sont déjà ajoutés.</span>
                            )}
                          </div>

                          <section className={styles.collectionVehicleSectionV1594}>
                            <div className={styles.collectionVehicleSectionTitleV1594}>
                              <div>
                                <span>VÉHICULES DE LA COLLECTION</span>
                                <strong>{collection.name}</strong>
                              </div>
                              <span>{collectionVehicles.length}</span>
                            </div>

                            {collectionVehicles.length > 0 ? (
                              <div className={styles.collectionVehicleTableV1594}>
                                <div className={styles.collectionVehicleTableHeadV1594}>
                                  <span>Véhicule</span>
                                  <span>Catalogue d’origine</span>
                                  <span>Action</span>
                                </div>

                                {collectionVehicles.map((vehicle) => (
                                  <div className={styles.collectionVehicleTableRowV1594} key={vehicle.id}>
                                    <div className={styles.collectionVehicleNameV1594}>
                                      <span>{(vehicle.brand || vehicle.model || "V").slice(0, 1).toUpperCase()}</span>
                                      <strong>{vehicle.brand} {vehicle.model}</strong>
                                    </div>
                                    <span className={styles.collectionVehicleOriginV1594}>
                                      {CATALOG_LABELS[vehicle.catalog_type]}
                                    </span>
                                    <form action={removeVehicleFromCollectionV159}>
                                      <input type="hidden" name="collection_id" value={collection.id} />
                                      <input type="hidden" name="vehicle_id" value={vehicle.id} />
                                      <button className={styles.collectionRemoveV1594} type="submit">Retirer</button>
                                    </form>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.collectionEmptyV1594}>
                                Aucun véhicule dans cette collection. Utilise la barre d’ajout ci-dessus.
                              </div>
                            )}
                          </section>

                          <details className={styles.collectionSettingsV1594}>
                            <summary>Paramètres de la collection</summary>
                            <div className={styles.collectionSettingsContentV1594}>
                              <form action={updateExclusiveCollectionV158} className={styles.collectionSettingsFormV1594}>
                                <input type="hidden" name="collection_id" value={collection.id} />
                                <label>
                                  Nom
                                  <input name="name" required defaultValue={collection.name} />
                                </label>
                                <label>
                                  Ordre
                                  <input type="number" name="sort_order" min="0" defaultValue={collection.sortOrder} />
                                </label>
                                <label className={styles.collectionSettingsDescriptionV1594}>
                                  Description
                                  <textarea name="description" rows={3} defaultValue={collection.description} />
                                </label>
                                <label className={styles.collectionSettingsVisibilityV1594}>
                                  <input type="checkbox" name="active" defaultChecked={collection.active} />
                                  Visible côté citoyen
                                </label>
                                <button className={styles.collectionSettingsSaveV1594} type="submit">
                                  Enregistrer
                                </button>
                              </form>

                              <form action={deleteExclusiveCollectionV158} className={styles.collectionDeleteV1594}>
                                <input type="hidden" name="collection_id" value={collection.id} />
                                <div>
                                  <strong>Supprimer la collection</strong>
                                  <small>Les fiches restent dans leurs catalogues d’origine.</small>
                                </div>
                                <button type="submit">Supprimer</button>
                              </form>
                            </div>
                          </details>
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.collectionNoCollectionV1594}>
                  Aucune collection créée pour le moment.
                </div>
              )}
            </section>
          )}

          <article className="backoffice-panel catalog-admin-create" id="nouveau-vehicule">
            <div className="panel-heading">
              <span className="panel-icon">
                ◈
              </span>
              <div>
                <h2>
                  Ajouter un véhicule
                </h2>
                <p>
                  Choisis son catalogue principal. Si tu sélectionnes une collection, la même fiche y sera aussi affichée sans duplication.
                </p>
              </div>
            </div>

            <form
              action={
                saveCatalogVehicleV51
              }
              className="backoffice-form backoffice-form-wide"
              encType="multipart/form-data"
            >
              <CatalogueAdminCreateFieldsV158
                catalogTypes={managedTypes.map((type) => ({ value: type, label: CATALOG_LABELS[type] }))}
                defaultCatalogType={createType}
                collections={exclusiveCollections.map((collection) => ({
                  id: collection.id,
                  name: collection.name,
                  active: collection.active,
                }))}
                defaultCollectionId={defaultCreateCollectionId}
              />

              <label>
                Marque
                <input
                  name="brand"
                  required
                />
              </label>

              <label>
                Modèle
                <input
                  name="model"
                  required
                />
              </label>

              <label>
                Prix (€)
                <input
                  name="price"
                  inputMode="decimal"
                  required
                />
              </label>

              <label>
                Quantité en stock
                <input
                  type="number"
                  name="stock_quantity"
                  min="0"
                  defaultValue="0"
                  required
                />
              </label>

              <label>
                Coffre
                <input name="trunk_capacity" />
              </label>

              <label>
                Vitesse maximale
                <input name="top_speed" />
              </label>

              <label>
                Puissance
                <input name="power" />
              </label>

              <label>
                Ordre d’affichage
                <input
                  type="number"
                  name="sort_order"
                  min="0"
                  defaultValue="0"
                />
              </label>

              <label className="form-span-2">
                Photo du véhicule
                <OptimizedImageInput name="images" maxFiles={1} targetKilobytes={800} />
              </label>

              <label className="form-span-3">
                Description
                <textarea
                  name="description"
                  rows={4}
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked
                />
                Publier immédiatement
              </label>

              <button
                className="btn"
                type="submit"
              >
                Ajouter le véhicule
              </button>
            </form>
          </article>

          <section className="catalog-admin-list">
            {visibleVehicles.length === 0 && (
              <div className="backoffice-panel empty-state">
                Aucun véhicule dans ce catalogue.
              </div>
            )}

            {visibleVehicles.map(
              (vehicle) => {
                const availability = commerceAvailability.get(Number(vehicle.id)) ?? {
                  vehicle_id: Number(vehicle.id),
                  reservation_enabled: true,
                  sale_enabled: true,
                };
                const merchandisingState = merchandising.get(Number(vehicle.id)) ?? {
                  vehicleId: Number(vehicle.id),
                  saleEnabled: false,
                  saleMode: "percent" as const,
                  saleValue: 0,
                  saleStartsAt: null,
                  saleEndsAt: null,
                  requiredTier: "all" as const,
                };
                const activeSale = getActiveVehicleSaleV157(merchandisingState, vehicle.price);

                return (
                <article
                  className="catalog-admin-card"
                  id={`vehicule-${vehicle.id}`}
                  key={vehicle.id}
                >
                  <div className="catalog-admin-card-head">
                    <div>
                      <span>
                        {vehicle.brand}
                      </span>
                      <h2>
                        {vehicle.model}
                      </h2>
                      <span
                        className={
                          styles.catalogType
                        }
                      >
                        {
                          CATALOG_LABELS[
                            vehicle.catalog_type
                          ]
                        }
                      </span>
                      {(exclusiveCollectionMap.get(Number(vehicle.id)) ?? []).map((collection) => (
                        <span className={styles.collectionLabelV158} key={collection.id}>
                          {collection.name}
                        </span>
                      ))}
                    </div>

                    <div className="catalog-admin-badges">
                      <span className="catalog-stock-pill">
                        Stock :{" "}
                        {vehicle.stock_quantity}
                      </span>
                      <span className="catalog-publish-pill">
                        {vehicle.published
                          ? "Publié"
                          : "Masqué"}
                      </span>
                    </div>
                  </div>

                  {vehicle.images.length >
                    0 && (
                    <div className="catalog-admin-images">
                      {vehicle.images.map(
                        (image, index) => (
                          <label
                            className="catalog-admin-image"
                            key={image.path}
                          >
                            <img
                              src={image.url}
                              alt={`${vehicle.brand} ${vehicle.model} — photo ${index + 1}`}
                              loading="lazy"
                            />
                            <span>
                              <input
                                type="checkbox"
                                name="remove_images"
                                value={image.path}
                                form={`vehicle-form-${vehicle.id}`}
                              />
                              Supprimer cette photo
                            </span>
                          </label>
                        ),
                      )}
                    </div>
                  )}

                  <form
                    id={`vehicle-form-${vehicle.id}`}
                    action={
                      saveCatalogVehicleV51
                    }
                    className="backoffice-form backoffice-form-wide"
                    encType="multipart/form-data"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={vehicle.id}
                    />

                    <label>
                      Catalogue
                      <select
                        name="catalog_type"
                        defaultValue={
                          vehicle.catalog_type
                        }
                      >
                        {managedTypes.map(
                          (type) => (
                            <option
                              value={type}
                              key={type}
                            >
                              {CATALOG_LABELS[type]}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      Marque
                      <input
                        name="brand"
                        required
                        defaultValue={
                          vehicle.brand
                        }
                      />
                    </label>

                    <label>
                      Modèle
                      <input
                        name="model"
                        required
                        defaultValue={
                          vehicle.model
                        }
                      />
                    </label>

                    <label>
                      Prix (€)
                      <input
                        name="price"
                        required
                        defaultValue={
                          vehicle.price
                        }
                      />
                    </label>

                    <label>
                      Quantité en stock
                      <input
                        type="number"
                        name="stock_quantity"
                        min="0"
                        required
                        defaultValue={
                          vehicle.stock_quantity
                        }
                      />
                    </label>

                    <label>
                      Coffre
                      <input
                        name="trunk_capacity"
                        defaultValue={
                          vehicle.trunk_capacity
                        }
                      />
                    </label>

                    <label>
                      Vitesse maximale
                      <input
                        name="top_speed"
                        defaultValue={
                          vehicle.top_speed
                        }
                      />
                    </label>

                    <label>
                      Puissance
                      <input
                        name="power"
                        defaultValue={
                          vehicle.power
                        }
                      />
                    </label>

                    <label>
                      Ordre d’affichage
                      <input
                        type="number"
                        name="sort_order"
                        min="0"
                        defaultValue={
                          vehicle.sort_order
                        }
                      />
                    </label>

                    <label className="form-span-2">
                      Remplacer la photo
                      <OptimizedImageInput name="images" maxFiles={1} targetKilobytes={800} />
                    </label>

                    <label className="form-span-3">
                      Description
                      <textarea
                        name="description"
                        rows={4}
                        defaultValue={
                          vehicle.description
                        }
                      />
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="published"
                        defaultChecked={
                          vehicle.published
                        }
                      />
                      Visible dans le catalogue
                    </label>

                    <button
                      className="btn"
                      type="submit"
                    >
                      Enregistrer et déplacer si nécessaire
                    </button>
                  </form>

                  <section className="catalog-admin-commerce-v127">
                    <div className="catalog-admin-commerce-heading-v127">
                      <div>
                        <span className="eyebrow">DISPONIBILITÉ COMMERCIALE</span>
                        <h3>Réservation et vente</h3>
                      </div>
                      <p>Le véhicule reste visible même si une action est bloquée.</p>
                    </div>

                    <div className="catalog-admin-commerce-grid-v127">
                      <div className="vehicle-commerce-control-v99">
                        <span
                          className={`vehicle-commerce-chip-v99${
                            availability.reservation_enabled
                              ? " is-enabled"
                              : " is-disabled"
                          }`}
                        >
                          Réservation {availability.reservation_enabled ? "autorisée" : "bloquée"}
                        </span>
                        <form action={setVehicleCommerceAvailability}>
                          <input type="hidden" name="vehicle_id" value={vehicle.id} />
                          <input
                            type="hidden"
                            name="reservation_enabled"
                            value={availability.reservation_enabled ? "false" : "true"}
                          />
                          <input
                            type="hidden"
                            name="sale_enabled"
                            value={availability.sale_enabled ? "true" : "false"}
                          />
                          <input
                            type="hidden"
                            name="return_to"
                            value={`/dashboard/catalogue?type=${selectedType}#vehicule-${vehicle.id}`}
                          />
                          <button
                            className={availability.reservation_enabled ? "btn btn-danger-v98" : "btn"}
                            type="submit"
                          >
                            {availability.reservation_enabled
                              ? "Bloquer la réservation"
                              : "Autoriser la réservation"}
                          </button>
                        </form>
                      </div>

                      <div className="vehicle-commerce-control-v99">
                        <span
                          className={`vehicle-commerce-chip-v99${
                            availability.sale_enabled ? " is-enabled" : " is-disabled"
                          }`}
                        >
                          Vente {availability.sale_enabled ? "autorisée" : "bloquée"}
                        </span>
                        <form action={setVehicleCommerceAvailability}>
                          <input type="hidden" name="vehicle_id" value={vehicle.id} />
                          <input
                            type="hidden"
                            name="reservation_enabled"
                            value={availability.reservation_enabled ? "true" : "false"}
                          />
                          <input
                            type="hidden"
                            name="sale_enabled"
                            value={availability.sale_enabled ? "false" : "true"}
                          />
                          <input
                            type="hidden"
                            name="return_to"
                            value={`/dashboard/catalogue?type=${selectedType}#vehicule-${vehicle.id}`}
                          />
                          <button
                            className={availability.sale_enabled ? "btn btn-danger-v98" : "btn"}
                            type="submit"
                          >
                            {availability.sale_enabled
                              ? "Bloquer la vente"
                              : "Autoriser la vente"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>

                  <section className="catalog-admin-merchandising-v157">
                    <div className="heading-v157">
                      <div>
                        <span className="eyebrow">VENTE & ACCÈS FIDÉLITÉ</span>
                        <h3>Soldes et grade autorisé</h3>
                      </div>
                      <div className="preview-v157">
                        {activeSale && (
                          <span className="catalogue-sale-badge-v157">◆ SOLDES -{activeSale.discountPercent}%</span>
                        )}
                        {merchandisingState.requiredTier !== "all" && (
                          <span className={`catalogue-tier-badge-v157 ${vehicleTierBadgeClassV157(merchandisingState.requiredTier)}`}>
                            ♛ {vehicleAccessTierLabelV157(merchandisingState.requiredTier).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    <form action={saveVehicleMerchandisingV157} className="form-v157">
                      <input type="hidden" name="vehicle_id" value={vehicle.id} />
                      <input type="hidden" name="return_to" value={`/dashboard/catalogue?type=${selectedType}`} />

                      <label className="check-v157">
                        <input
                          type="checkbox"
                          name="sale_enabled"
                          defaultChecked={merchandisingState.saleEnabled}
                          disabled={vehicle.catalog_type === "concession"}
                        />
                        {vehicle.catalog_type === "concession" ? "Soldes indisponibles sur la location" : "Mettre ce véhicule en soldes"}
                      </label>

                      <label>
                        Type de remise
                        <select name="sale_mode" defaultValue={merchandisingState.saleMode} disabled={vehicle.catalog_type === "concession"}>
                          <option value="percent">Pourcentage (%)</option>
                          <option value="price">Prix soldé fixe (€)</option>
                        </select>
                      </label>

                      <label>
                        Valeur
                        <input
                          type="number"
                          name="sale_value"
                          min="0"
                          step="0.01"
                          defaultValue={merchandisingState.saleValue || ""}
                          disabled={vehicle.catalog_type === "concession"}
                        />
                      </label>

                      <label>
                        Achat réservé à
                        <select name="required_tier" defaultValue={merchandisingState.requiredTier} disabled={vehicle.catalog_type === "concession"}>
                          <option value="all">Tous les membres</option>
                          <option value="silver">Silver</option>
                          <option value="gold">Gold</option>
                          <option value="black_signature">Black Signature</option>
                        </select>
                        {vehicle.catalog_type === "concession" && <small>Les grades d’achat ne s’appliquent pas aux véhicules de location.</small>}
                      </label>

                      <label className="wide-v157">
                        Début des soldes · facultatif
                        <input type="datetime-local" name="sale_starts_at" defaultValue={merchandisingState.saleStartsAt ? merchandisingState.saleStartsAt.slice(0, 16) : ""} disabled={vehicle.catalog_type === "concession"} />
                      </label>
                      <label className="wide-v157">
                        Fin des soldes · facultatif
                        <input type="datetime-local" name="sale_ends_at" defaultValue={merchandisingState.saleEndsAt ? merchandisingState.saleEndsAt.slice(0, 16) : ""} disabled={vehicle.catalog_type === "concession"} />
                      </label>

                      <button className="btn" type="submit">Enregistrer soldes & accès</button>
                    </form>
                  </section>

                  <form
                    action={
                      deleteCatalogVehicleV51
                    }
                    className="danger-form"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={vehicle.id}
                    />
                    <input
                      type="hidden"
                      name="catalog_type"
                      value={
                        vehicle.catalog_type
                      }
                    />
                    <button type="submit">
                      Supprimer définitivement
                    </button>
                  </form>
                </article>
                );
              },
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
