/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  deleteCatalogVehicleV51,
  saveCatalogVehicleV51,
} from "@/app/actions/catalogue-v51";
import { setVehicleCommerceAvailability } from "@/app/actions/vehicle-reservation-settings";
import {
  DashboardHeader,
} from "@/components/dashboard/dashboard-header";
import {
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";
import { OptimizedImageInput } from "@/components/forms/optimized-image-input";
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
  }>;
}) {
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
  const commerceAvailability = await getVehicleCommerceAvailabilityMap(
    managedVehicles.map((vehicle) => Number(vehicle.id)),
  );

  const selectedType:
    | CatalogType
    | "all" =
    params.type === "all" || params.type === "used"
      ? "all"
      : normalizeCatalogType(
          params.type,
        );

  const visibleVehicles =
    selectedType === "all"
      ? managedVehicles
      : managedVehicles.filter(
          (vehicle) =>
            vehicle.catalog_type ===
            selectedType,
        );

  const createType:
    CatalogType =
    selectedType === "all"
      ? "standard"
      : selectedType;

  return (
    <DashboardShell>
      <DashboardHeader
        title="Catalogue Nostra Motors"
        description="Chaque véhicule appartient à un seul catalogue. Choisis sa destination lors de l’ajout ou déplace-le ensuite avec le champ Catalogue."
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
              href="/dashboard/catalogue?type=all"
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
                href={`/dashboard/catalogue?type=${type}`}
                key={type}
              >
                {CATALOG_LABELS[type]} ·{" "}
                {
                  managedVehicles.filter(
                    (vehicle) =>
                      vehicle.catalog_type ===
                      type,
                  ).length
                }
              </Link>
            ))}

            <Link className={styles.adminTab} href="/dashboard/occasion/rachats">
              Véhicules d’occasion →
            </Link>
          </nav>

          <article className="backoffice-panel catalog-admin-create">
            <div className="panel-heading">
              <span className="panel-icon">
                ◈
              </span>
              <div>
                <h2>
                  Ajouter un véhicule
                </h2>
                <p>
                  Le véhicule apparaîtra uniquement dans le catalogue choisi.
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
              <label>
                Catalogue
                <select
                  name="catalog_type"
                  defaultValue={createType}
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
