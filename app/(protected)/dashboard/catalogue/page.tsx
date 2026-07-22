/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  deleteCatalogVehicleV51,
  saveCatalogVehicleV51,
} from "@/app/actions/catalogue-v51";
import {
  DashboardHeader,
} from "@/components/dashboard/dashboard-header";
import {
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";
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
      "Chaque photo doit peser moins de 5 Mo.",
    "too-many":
      "Un véhicule peut contenir au maximum 6 photos.",
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

  const selectedType:
    | CatalogType
    | "all" =
    params.type === "all"
      ? "all"
      : normalizeCatalogType(
          params.type,
        );

  const visibleVehicles =
    selectedType === "all"
      ? allVehicles
      : allVehicles.filter(
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
            Exécute le fichier SQL V51 puis recharge la page.
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
              Tous · {allVehicles.length}
            </Link>

            {CATALOG_TYPES.map((type) => (
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
                  allVehicles.filter(
                    (vehicle) =>
                      vehicle.catalog_type ===
                      type,
                  ).length
                }
              </Link>
            ))}
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
                  {CATALOG_TYPES.map(
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
                Photos
                <input
                  type="file"
                  name="images"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                />
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
              (vehicle) => (
                <article
                  className="catalog-admin-card"
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
                        {CATALOG_TYPES.map(
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
                      Ajouter des photos
                      <input
                        type="file"
                        name="images"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                      />
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
              ),
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
