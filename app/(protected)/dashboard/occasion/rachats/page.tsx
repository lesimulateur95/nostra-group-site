/* eslint-disable @next/next/no-img-element */

import {
  createUsedVehiclePurchase,
  deleteUsedVehiclePurchase,
  updateUsedVehiclePurchase,
} from "@/app/actions/used-vehicles";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import {
  USED_CONDITION_LABELS,
  USED_STATUS_LABELS,
  getUsedVehicleDashboardSummary,
  getUsedVehicles,
  getUsedVehiclesConfigured,
} from "@/lib/used-vehicles/data";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function errorMessage(code?: string) {
  const messages: Record<string, string> = {
    invalid: "Vérifie les informations obligatoires et les montants.",
    "image-type": "Les photos doivent être au format JPG, PNG ou WEBP.",
    "image-size": "Chaque photo doit peser moins de 7 Mo.",
    "too-many": "Un véhicule peut contenir au maximum 8 photos.",
    upload: "Impossible d’envoyer les photos dans Supabase Storage.",
    registration: "Cette immatriculation est déjà utilisée par un autre véhicule d’occasion.",
    "active-order": "Ce véhicule possède une commande active et ne peut pas être supprimé.",
    sales: "Ce véhicule possède un historique de vente. Garde sa fiche pour conserver la traçabilité comptable.",
    "not-found": "Le véhicule n’existe plus.",
    forbidden: "Ton rôle ne permet pas cette action.",
    setup: "Le module Véhicules d’occasion doit encore être activé avec le SQL V92.",
    "use-dedicated": "Utilise cette page dédiée pour gérer les véhicules d’occasion.",
    save: "Impossible d’enregistrer le véhicule.",
  };
  return messages[code ?? ""] ?? "Impossible d’effectuer cette action.";
}

export default async function UsedVehiclePurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const configured = await getUsedVehiclesConfigured();
  const [vehicles, summary] = configured
    ? await Promise.all([getUsedVehicles(), getUsedVehicleDashboardSummary()])
    : [[], await getUsedVehicleDashboardSummary()];

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Concession — Véhicules rachetés"
        description="Enregistre les rachats, le prix d’achat privé, le tarif de revente et toutes les informations internes du véhicule."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/rachats" />

      {params.created && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Le véhicule racheté a été ajouté au stock et la dépense a été enregistrée en comptabilité.
        </div>
      )}
      {params.updated && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La fiche du véhicule a été mise à jour.
        </div>
      )}
      {params.deleted && (
        <div className="dashboard-feedback">Le véhicule racheté a été supprimé.</div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {errorMessage(params.error)}
        </div>
      )}

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer la concession de véhicules d’occasion</h2>
          <p>
            Exécute le fichier <strong>supabase/used-vehicles-v92.sql</strong>, puis recharge cette page.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.kpis}>
            <article className={styles.kpi}>
              <span>Véhicules enregistrés</span>
              <strong>{summary.vehicles}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Disponibles</span>
              <strong>{summary.available}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Valeur d’achat du stock</span>
              <strong>{money(summary.stockValue)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Marge prévue du stock</span>
              <strong>{money(summary.expectedMargin)}</strong>
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Enregistrer un nouveau rachat</h2>
                <p>
                  Le véhicule entre automatiquement dans le stock public et le prix de rachat devient une dépense comptable.
                </p>
              </div>
            </div>

            <form
              action={createUsedVehiclePurchase}
              className={styles.form}
              encType="multipart/form-data"
            >
              <label>
                Marque
                <input name="brand" required maxLength={100} />
              </label>
              <label>
                Modèle
                <input name="model" required maxLength={140} />
              </label>
              <label>
                Version
                <input name="version" maxLength={140} />
              </label>
              <label>
                Immatriculation
                <input name="registration" maxLength={40} />
              </label>

              <label>
                Ancien propriétaire
                <input name="previous_owner" maxLength={180} />
              </label>
              <label>
                Date du rachat
                <input name="purchase_date" type="date" required />
              </label>
              <label>
                Prix de rachat unitaire (€)
                <input name="purchase_price" inputMode="decimal" required />
              </label>
              <label>
                Prix de revente unitaire (€)
                <input name="resale_price" inputMode="decimal" required />
              </label>

              <label>
                Quantité rachetée
                <input name="quantity" type="number" min="1" defaultValue="1" required />
              </label>
              <label>
                État du véhicule
                <select name="vehicle_condition" defaultValue="good">
                  {Object.entries(USED_CONDITION_LABELS).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Coffre
                <input name="trunk_capacity" maxLength={100} />
              </label>
              <label>
                Vitesse maximale
                <input name="top_speed" maxLength={100} />
              </label>
              <label>
                Puissance
                <input name="power" maxLength={100} />
              </label>
              <label>
                Ordre d’affichage
                <input name="sort_order" type="number" min="0" defaultValue="0" />
              </label>
              <label className={styles.span2}>
                Photos du véhicule
                <input
                  name="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                />
              </label>

              <label className={styles.span2}>
                Description publique
                <textarea name="description" rows={5} />
              </label>
              <label className={styles.span2}>
                Notes internes
                <textarea name="internal_notes" rows={5} />
              </label>

              <label className={styles.check}>
                <input name="published" type="checkbox" defaultChecked />
                Publier immédiatement dans « Véhicules d’occasion »
              </label>

              <button className={styles.primary} type="submit">
                Enregistrer le rachat
              </button>
            </form>
          </section>

          <section className={styles.section}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Véhicules rachetés</h2>
                <p>{vehicles.length} fiche(s) enregistrée(s).</p>
              </div>
            </div>

            {vehicles.length === 0 ? (
              <div className={styles.panel + " " + styles.empty}>
                Aucun véhicule racheté pour le moment.
              </div>
            ) : (
              <div className={styles.grid}>
                {vehicles.map((vehicle) => (
                  <article className={styles.vehicleCard} key={vehicle.vehicleId}>
                    <div className={styles.vehicleTop}>
                      {vehicle.images[0] ? (
                        <img
                          className={styles.vehicleImage}
                          src={vehicle.images[0].url}
                          alt={`${vehicle.brand} ${vehicle.model}`}
                        />
                      ) : (
                        <div className={styles.placeholder}>PHOTO À VENIR</div>
                      )}

                      <div className={styles.vehicleCopy}>
                        <p>{vehicle.brand}</p>
                        <h2>
                          {vehicle.model}
                          {vehicle.version ? ` ${vehicle.version}` : ""}
                        </h2>
                        <div className={styles.badges}>
                          <span className={styles.badge}>
                            {USED_STATUS_LABELS[vehicle.status]}
                          </span>
                          <span className={styles.badge}>
                            Stock : {vehicle.stockQuantity}
                          </span>
                          <span className={styles.badge}>
                            {vehicle.published ? "Publié" : "Masqué"}
                          </span>
                        </div>
                        <div className={styles.moneyGrid}>
                          <div>
                            <span>Rachat</span>
                            <strong>{money(vehicle.purchasePrice)}</strong>
                          </div>
                          <div>
                            <span>Revente</span>
                            <strong>{money(vehicle.resalePrice)}</strong>
                          </div>
                          <div>
                            <span>Marge prévue</span>
                            <strong
                              className={
                                vehicle.expectedUnitMargin >= 0
                                  ? styles.positive
                                  : styles.negative
                              }
                            >
                              {money(vehicle.expectedUnitMargin)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.panel} style={{ border: 0, borderRadius: 0 }}>
                      {vehicle.images.length > 0 && (
                        <div className={styles.imageStrip}>
                          {vehicle.images.map((image, index) => (
                            <label className={styles.imageItem} key={image.path}>
                              <img
                                src={image.url}
                                alt={`${vehicle.brand} ${vehicle.model} photo ${index + 1}`}
                              />
                              <span>
                                <input
                                  type="checkbox"
                                  name="remove_images"
                                  value={image.path}
                                  form={`used-vehicle-${vehicle.vehicleId}`}
                                />{" "}
                                Supprimer
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      <form
                        id={`used-vehicle-${vehicle.vehicleId}`}
                        action={updateUsedVehiclePurchase}
                        className={styles.form}
                        encType="multipart/form-data"
                      >
                        <input type="hidden" name="vehicle_id" value={vehicle.vehicleId} />

                        <label>
                          Marque
                          <input name="brand" defaultValue={vehicle.brand} required />
                        </label>
                        <label>
                          Modèle
                          <input name="model" defaultValue={vehicle.model} required />
                        </label>
                        <label>
                          Version
                          <input name="version" defaultValue={vehicle.version} />
                        </label>
                        <label>
                          Immatriculation
                          <input name="registration" defaultValue={vehicle.registration} />
                        </label>
                        <label>
                          Ancien propriétaire
                          <input name="previous_owner" defaultValue={vehicle.previousOwner} />
                        </label>
                        <label>
                          Date du rachat
                          <input name="purchase_date" type="date" defaultValue={vehicle.purchaseDate} required />
                        </label>
                        <label>
                          Prix de rachat (€)
                          <input name="purchase_price" defaultValue={vehicle.purchasePrice} required />
                        </label>
                        <label>
                          Prix de revente (€)
                          <input name="resale_price" defaultValue={vehicle.resalePrice} required />
                        </label>
                        <label>
                          Quantité rachetée
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            defaultValue={vehicle.purchaseQuantity}
                            required
                          />
                        </label>
                        <label>
                          État
                          <select name="vehicle_condition" defaultValue={vehicle.condition}>
                            {Object.entries(USED_CONDITION_LABELS).map(([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Coffre
                          <input name="trunk_capacity" defaultValue={vehicle.trunkCapacity} />
                        </label>
                        <label>
                          Vitesse maximale
                          <input name="top_speed" defaultValue={vehicle.topSpeed} />
                        </label>
                        <label>
                          Puissance
                          <input name="power" defaultValue={vehicle.power} />
                        </label>
                        <label>
                          Ordre d’affichage
                          <input
                            name="sort_order"
                            type="number"
                            min="0"
                            defaultValue={vehicle.sortOrder}
                          />
                        </label>
                        <label className={styles.span2}>
                          Ajouter des photos
                          <input
                            name="images"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                          />
                        </label>
                        <label className={styles.span2}>
                          Description publique
                          <textarea name="description" rows={4} defaultValue={vehicle.description} />
                        </label>
                        <label className={styles.span2}>
                          Notes internes
                          <textarea name="internal_notes" rows={4} defaultValue={vehicle.internalNotes} />
                        </label>
                        <label className={styles.check}>
                          <input name="published" type="checkbox" defaultChecked={vehicle.published} />
                          Visible côté public
                        </label>
                        <button className={styles.primary} type="submit">
                          Enregistrer les modifications
                        </button>
                      </form>

                      <form action={deleteUsedVehiclePurchase} className={styles.actions}>
                        <input type="hidden" name="vehicle_id" value={vehicle.vehicleId} />
                        <button className={styles.danger} type="submit">
                          Supprimer définitivement le véhicule
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
