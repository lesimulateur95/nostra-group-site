/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";

import { addConfiguredVehicleWithProfileDelivery } from "@/app/actions/configured-profile-delivery";
import { joinVehicleWaitlistV155 } from "@/app/actions/v155";
import type { CatalogVehicleImage } from "@/lib/backoffice/data";
import { isVehicleReservationEnabled } from "@/lib/vehicle-reservation-settings/data";
import { getVehicleCommerceAvailability } from "@/lib/vehicle-commerce-settings/data";
import { getVehicleFinancingSettings } from "@/lib/vehicle-financing/data";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

const HOME_DELIVERY_PRICE = 75_000;

function formatPrice(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function images(value: unknown): CatalogVehicleImage[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is CatalogVehicleImage => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;

    return (
      typeof candidate.url === "string" &&
      typeof candidate.path === "string"
    );
  });
}


function usedConditionLabel(value: unknown): string {
  const labels: Record<string, string> = {
    excellent: "Excellent état",
    very_good: "Très bon état",
    good: "Bon état",
    fair: "État correct",
    repair: "À remettre en état",
  };
  const key = typeof value === "string" ? value : "";
  return labels[key] ?? "Contrôlé par Nostra Motors";
}

function metadataText(
  metadata: Record<string, unknown>,
  key: string,
): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

type VehicleConfigurationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function VehicleConfigurationPage({
  params,
  searchParams,
}: VehicleConfigurationPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const vehicleId = Number.parseInt(id, 10);

  if (!Number.isFinite(vehicleId) || vehicleId <= 0) notFound();

  const supabase = await createClient();
  const [vehicleResult, authResult] = await Promise.all([
    supabase
      .from("catalog_vehicles")
      .select(
        "id,brand,model,trunk_capacity,top_speed,power,price,description,images,published,stock_quantity,catalog_type,used_vehicle_status,used_condition",
      )
      .eq("id", vehicleId)
      .eq("published", true)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const { data: vehicle, error } = vehicleResult;
  if (error || !vehicle) notFound();

  const metadata = (authResult.data.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const profilePhone = metadataText(metadata, "phone");
  const profileAddress = metadataText(metadata, "address");
  const vehicleImages = images(vehicle.images);
  const vehiclePrice = Number(vehicle.price) || 0;
  const depositAmount = Math.round(vehiclePrice * 0.15 * 100) / 100;
  const balanceAmount = Math.max(0, vehiclePrice - depositAmount);
  const stock = Math.max(0, Number(vehicle.stock_quantity) || 0);
  const isHeavyVehicle = vehicle.catalog_type === "heavy";
  const isRentalCatalog = vehicle.catalog_type === "concession";
  const isUsedVehicle = vehicle.catalog_type === "used";
  const usedStatus = String(vehicle.used_vehicle_status ?? "available");
  const canOrderUsedVehicle = !isUsedVehicle || usedStatus === "available";
  const privateSaleResult = await (supabase as any)
    .from("nostra_private_sales_v155")
    .select("min_loyalty_points,starts_at,ends_at,enabled")
    .eq("vehicle_id", vehicleId)
    .eq("enabled", true);
  const privateSaleNow = Date.now();
  const activePrivateSale = (privateSaleResult.data ?? []).find((row: any) =>
    (!row.starts_at || new Date(row.starts_at).getTime() <= privateSaleNow) &&
    (!row.ends_at || new Date(row.ends_at).getTime() >= privateSaleNow),
  );
  let vipBlocked = false;
  let vipRequiredPoints = 0;
  if (activePrivateSale && authResult.data.user) {
    const { data: loyaltyPoints } = await (supabase as any).rpc("nostra_loyalty_points_v155", { p_user_id: authResult.data.user.id });
    vipRequiredPoints = Number(activePrivateSale.min_loyalty_points ?? 0);
    vipBlocked = Number(loyaltyPoints ?? 0) < vipRequiredPoints;
  }
  const [catalogReservationsEnabled, vehicleAvailability, financingSettings] = await Promise.all([
    isVehicleReservationEnabled(String(vehicle.catalog_type ?? "standard")),
    getVehicleCommerceAvailability(vehicleId),
    getVehicleFinancingSettings(),
  ]);
  const canReserve =
    !isRentalCatalog &&
    catalogReservationsEnabled &&
    vehicleAvailability.reservation_enabled;
  const canOrder = vehicleAvailability.sale_enabled;
  const financingEligible =
    financingSettings.configured &&
    financingSettings.enabled &&
    canOrder &&
    !isRentalCatalog &&
    vehiclePrice > financingSettings.minimumVehiclePrice &&
    (financingSettings.threeTimesEnabled || financingSettings.fourTimesEnabled);
  const financingDeposit = Math.round(vehiclePrice * 0.3 * 100) / 100;
  const financingPrincipal = Math.max(0, vehiclePrice - financingDeposit);
  const financingThreeFee =
    Math.round(
      financingPrincipal * (financingSettings.threeTimesFeePercent / 100) * 100,
    ) / 100;
  const financingFourFee =
    Math.round(
      financingPrincipal * (financingSettings.fourTimesFeePercent / 100) * 100,
    ) / 100;
  const financingThreePayment =
    Math.round(((financingPrincipal + financingThreeFee) / 3) * 100) / 100;
  const financingFourPayment =
    Math.round(((financingPrincipal + financingFourFee) / 4) * 100) / 100;
  const canPurchase = (canReserve || canOrder) && !vipBlocked;
  const cataloguePath =
    vehicle.catalog_type === "concession"
      ? "/motors/catalogue/location"
      : vehicle.catalog_type === "heavy"
        ? "/motors/catalogue/poids-lourds"
        : vehicle.catalog_type === "exclusive"
          ? "/motors/catalogue/vehicules-exclusifs"
          : vehicle.catalog_type === "used"
            ? "/motors/catalogue/vehicules-occasion"
            : "/motors/catalogue";

  const errorMessage =
    query.error === "stock"
      ? "Ce véhicule n’est plus disponible dans cette quantité."
      : query.error === "setup"
        ? "Le profil de livraison doit encore être activé dans Supabase."
        : query.error === "delivery"
          ? "Choisis un mode de livraison valide."
          : query.error === "heavy-delivery"
            ? "La livraison à domicile est désactivée pour les poids lourds. Le retrait au showroom est obligatoire."
            : query.error === "used-unavailable"
              ? "Ce véhicule d’occasion est déjà réservé, vendu ou indisponible."
              : query.error === "address"
              ? "Renseigne une adresse de livraison complète."
              : query.error === "phone"
                ? "Renseigne un numéro de téléphone pour la livraison."
                : query.error === "purchase"
                  ? "Choisis entre réserver le véhicule ou le commander directement."
                  : query.error === "reservation-exists"
                    ? "Tu as déjà une réservation active pour ce véhicule."
                    : query.error === "reservation-disabled"
                      ? "Les réservations sont actuellement désactivées pour ce catalogue."
                    : query.error === "reservation-vehicle-disabled"
                      ? "La réservation est temporairement bloquée pour ce véhicule précis."
                    : query.error === "sale-disabled"
                      ? "La vente directe est temporairement bloquée pour ce véhicule précis."
                    : query.error === "financing-disabled"
                      ? "Les dossiers de financement sont actuellement fermés."
                    : query.error === "financing-term"
                      ? "Le nombre d’échéances choisi est actuellement indisponible."
                    : query.error === "financing-minimum"
                      ? "Le financement 3×/4× est réservé aux véhicules strictement supérieurs à 500 000 €."
                    : query.error === "financing-exists"
                      ? "Tu as déjà un dossier de financement actif pour ce véhicule."
                    : query.error === "financing-steam"
                      ? "Associe ton compte Steam avant de déposer un dossier de financement."
                    : query.error === "rental-mode"
                      ? "Les véhicules du catalogue location peuvent uniquement être loués avec retrait en concession Nostra Motors."
                    : query.error === "vip-required"
                      ? "Cette offre est réservée aux citoyens ayant le niveau de fidélité VIP requis."
                    : query.error
                      ? "Impossible d’ajouter cette configuration au panier."
                      : null;

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CONFIGURATION DE LA COMMANDE</p>
          <h1>
            {vehicle.brand} {vehicle.model}
          </h1>
          <p>
            {isRentalCatalog
              ? "Vérifie le véhicule de location avant de l’ajouter au panier. Le retrait s’effectue uniquement en concession Nostra Motors."
              : isHeavyVehicle
              ? "Vérifie le poids lourd avant de l’ajouter au panier. Le retrait au showroom est le seul mode disponible."
              : isUsedVehicle
                ? "Vérifie ce véhicule d’occasion contrôlé par Nostra Motors, puis choisis son mode de livraison."
                : "Vérifie le véhicule, puis choisis son mode de livraison avant de l’ajouter au panier."}
          </p>
        </div>
        <Link className={styles.backLink} href={cataloguePath}>
          ← Retour au catalogue
        </Link>
      </header>

      {errorMessage && <div className={styles.error}>{errorMessage}</div>}

      <div className={styles.layout}>
        <section className={styles.vehicleCard}>
          <div className={styles.media}>
            {vehicleImages[0] ? (
              <img
                src={vehicleImages[0].url}
                alt={`${vehicle.brand} ${vehicle.model}`}
              />
            ) : (
              <div className={styles.placeholder}>PHOTO À VENIR</div>
            )}
          </div>

          <div className={styles.vehicleContent}>
            <p className={styles.eyebrow}>{vehicle.brand}</p>
            <h2>{vehicle.model}</h2>
            {vehicle.description && (
              <p className={styles.description}>{vehicle.description}</p>
            )}

            <dl className={styles.specs}>
              <div>
                <dt>Coffre</dt>
                <dd>{vehicle.trunk_capacity || "Non renseigné"}</dd>
              </div>
              <div>
                <dt>Vitesse maximale</dt>
                <dd>{vehicle.top_speed || "Non renseignée"}</dd>
              </div>
              <div>
                <dt>{isUsedVehicle ? "État" : "Puissance"}</dt>
                <dd>
                  {isUsedVehicle
                    ? usedConditionLabel(vehicle.used_condition)
                    : vehicle.power || "Non renseignée"}
                </dd>
              </div>
              <div>
                <dt>Disponibilité</dt>
                <dd>
                  {isUsedVehicle
                    ? usedStatus === "sold"
                      ? "Vendu"
                      : usedStatus === "reserved"
                        ? "Réservé"
                        : `${stock} disponible${stock > 1 ? "s" : ""}`
                    : `${stock} en stock`}
                </dd>
              </div>
            </dl>

            <div className={styles.vehiclePrice}>
              <span>Prix du véhicule</span>
              <strong>{formatPrice(vehiclePrice)}</strong>
            </div>
          </div>
        </section>

        <form
          action={addConfiguredVehicleWithProfileDelivery}
          className={styles.deliveryCard}
        >
          <input type="hidden" name="vehicle_id" value={vehicle.id} />
          <input type="hidden" name="profile_phone" value={profilePhone} />
          {isRentalCatalog && (
            <>
              <input type="hidden" name="purchase_mode" value="order" />
              <input type="hidden" name="delivery_mode" value="showroom" />
            </>
          )}

          <div className={styles.deliveryHeading}>
            <p className={styles.eyebrow}>
              {isRentalCatalog ? "LOCATION" : "CHOIX D’ACHAT"}
            </p>
            <h2>
              {isRentalCatalog
                ? canOrder
                  ? "Louer ce véhicule"
                  : "Véhicule temporairement indisponible"
                : canReserve && canOrder
                  ? "Réserver ou commander ?"
                  : canReserve
                    ? "Réserver le véhicule"
                    : canOrder
                      ? "Commander le véhicule"
                      : "Véhicule temporairement indisponible"}
            </h2>
          </div>

          {canOrder && (
            isRentalCatalog ? (
              <div className={`${styles.option} ${styles.purchaseOption}`}>
                <span className={styles.optionIcon}>◆</span>
                <span className={styles.optionText}>
                  <strong>Louer</strong>
                  <small>
                    Le véhicule est ajouté à ton panier de location. La remise
                    du véhicule se fera exclusivement à la concession Nostra Motors.
                  </small>
                </span>
                <span className={styles.optionPrice}>{formatPrice(vehiclePrice)}</span>
              </div>
            ) : (
              <label className={`${styles.option} ${styles.purchaseOption}`}>
                <input
                  type="radio"
                  name="purchase_mode"
                  value="order"
                  defaultChecked
                />
                <span className={styles.optionIcon}>✓</span>
                <span className={styles.optionText}>
                  <strong>Commander maintenant</strong>
                  <small>
                    Le prix total du véhicule est ajouté au panier et la commande
                    suit le fonctionnement habituel.
                  </small>
                </span>
                <span className={styles.optionPrice}>{formatPrice(vehiclePrice)}</span>
              </label>
            )
          )}

          {canReserve && (
            <label className={`${styles.option} ${styles.purchaseOption}`}>
              <input
                type="radio"
                name="purchase_mode"
                value="reservation"
                defaultChecked={!canOrder}
              />
              <span className={styles.optionIcon}>15 %</span>
              <span className={styles.optionText}>
                <strong>Réserver avec un acompte</strong>
                <small>
                  Tu paies {formatPrice(depositAmount)} maintenant. Après
                  validation par la concession, les {formatPrice(balanceAmount)}
                  restants seront ajoutés automatiquement à ton panier.
                </small>
              </span>
              <span className={styles.optionPrice}>
                {formatPrice(depositAmount)}
              </span>
            </label>
          )}

          {financingEligible && financingSettings.threeTimesEnabled && (
            <label className={`${styles.option} ${styles.financingOption}`}>
              <input type="radio" name="purchase_mode" value="financing_3" />
              <span className={styles.optionIcon}>3×</span>
              <span className={styles.optionText}>
                <strong>Demander un financement en 3 fois</strong>
                <small>
                  Dossier soumis au Gérant. Apport obligatoire de 30 %, puis 3
                  échéances avec {financingSettings.threeTimesFeePercent} % de
                  frais sur le montant financé.
                </small>
              </span>
              <span className={styles.optionPrice}>
                {formatPrice(financingThreePayment)} / échéance
              </span>
            </label>
          )}

          {financingEligible && financingSettings.fourTimesEnabled && (
            <label className={`${styles.option} ${styles.financingOption}`}>
              <input type="radio" name="purchase_mode" value="financing_4" />
              <span className={styles.optionIcon}>4×</span>
              <span className={styles.optionText}>
                <strong>Demander un financement en 4 fois</strong>
                <small>
                  Dossier soumis au Gérant. Apport obligatoire de 30 %, puis 4
                  échéances avec {financingSettings.fourTimesFeePercent} % de
                  frais sur le montant financé.
                </small>
              </span>
              <span className={styles.optionPrice}>
                {formatPrice(financingFourPayment)} / échéance
              </span>
            </label>
          )}

          {financingEligible && (
            <div className={styles.financingFile}>
              <p className={styles.eyebrow}>DOSSIER DE FINANCEMENT</p>
              <h3>Accompagne ta demande</h3>
              <label htmlFor="financing_note">
                Message pour accompagner le dossier <small>(facultatif)</small>
              </label>
              <textarea
                id="financing_note"
                name="financing_note"
                rows={3}
                maxLength={1500}
                placeholder="Exemple : informations utiles pour l’étude de mon dossier…"
              />
              <div className={styles.financingSummary}>
                <span>Apport obligatoire</span>
                <strong>{formatPrice(financingDeposit)}</strong>
                <span>Reste financé avant frais</span>
                <strong>{formatPrice(financingPrincipal)}</strong>
              </div>
            </div>
          )}

          {!isRentalCatalog &&
            financingSettings.configured &&
            vehiclePrice <= financingSettings.minimumVehiclePrice && (
              <div className={styles.notice}>
                Le paiement en 3×/4× est disponible uniquement pour les
                véhicules dont le prix dépasse 500 000 €.
              </div>
            )}

          {!vehicleAvailability.sale_enabled && (
            <div className={styles.notice}>
              {isRentalCatalog
                ? "La location est temporairement suspendue pour ce véhicule. Il reste visible dans le catalogue."
                : "La vente directe est temporairement suspendue pour ce véhicule. Il reste visible dans le catalogue."}
            </div>
          )}

          {!isRentalCatalog && !vehicleAvailability.reservation_enabled && (
            <div className={styles.notice}>
              La réservation avec acompte est temporairement suspendue pour ce
              véhicule.
            </div>
          )}

          {!isRentalCatalog &&
            vehicleAvailability.reservation_enabled &&
            !catalogReservationsEnabled && (
              <div className={styles.notice}>
                Les réservations sont actuellement fermées pour l’ensemble de ce
                catalogue.
              </div>
            )}

          {vipBlocked && (
            <div className={styles.error}>
              Vente privée : cette offre nécessite au minimum {vipRequiredPoints.toLocaleString("fr-FR")} points Nostra.
            </div>
          )}

          {!canPurchase && !vipBlocked && (
            <div className={styles.error}>
              {isRentalCatalog
                ? "La location est temporairement suspendue pour ce véhicule. Tu peux toujours consulter sa fiche dans le catalogue."
                : "La réservation et la vente sont temporairement suspendues pour ce véhicule. Tu peux toujours consulter sa fiche dans le catalogue."}
            </div>
          )}

          <div className={styles.sectionDivider} />

          <div className={styles.deliveryHeading}>
            <p className={styles.eyebrow}>
              {isRentalCatalog ? "RETRAIT DU VÉHICULE" : "MODE DE LIVRAISON"}
            </p>
            <h2>
              {isRentalCatalog
                ? "Retrait obligatoire en concession"
                : isHeavyVehicle
                  ? "Retrait obligatoire au showroom"
                  : "Où souhaites-tu recevoir le véhicule ?"}
            </h2>
          </div>

          {isRentalCatalog ? (
            <div className={styles.option}>
              <span className={styles.optionIcon}>◆</span>
              <span className={styles.optionText}>
                <strong>Retrait en concession Nostra Motors</strong>
                <small>
                  Les véhicules de location ne sont ni livrés à domicile ni
                  expédiés. La remise des clés se fait uniquement en concession.
                </small>
              </span>
              <span className={styles.optionPrice}>Obligatoire</span>
            </div>
          ) : isHeavyVehicle ? (
            <>
              <input type="hidden" name="delivery_mode" value="showroom" />
              <div className={styles.option}>
                <span className={styles.optionIcon}>◆</span>
                <span className={styles.optionText}>
                  <strong>Retrait au showroom</strong>
                  <small>
                    Les poids lourds ne sont pas éligibles à la livraison à
                    domicile.
                  </small>
                </span>
                <span className={styles.optionPrice}>Gratuit</span>
              </div>
            </>
          ) : (
            <>
              <label className={styles.option}>
                <input
                  type="radio"
                  name="delivery_mode"
                  value="showroom"
                  defaultChecked
                />
                <span className={styles.optionIcon}>◆</span>
                <span className={styles.optionText}>
                  <strong>Retrait au showroom</strong>
                  <small>
                    Le véhicule sera récupéré directement chez Nostra Motors.
                  </small>
                </span>
                <span className={styles.optionPrice}>Gratuit</span>
              </label>

              <label className={styles.option}>
                <input type="radio" name="delivery_mode" value="home" />
                <span className={styles.optionIcon}></span>
                <span className={styles.optionText}>
                  <strong>Livraison à domicile</strong>
                  <small>
                    Un camion transporte le véhicule jusqu’à l’adresse indiquée.
                  </small>
                </span>
                <span className={styles.optionPrice}>
                  {formatPrice(HOME_DELIVERY_PRICE)}
                </span>
              </label>

              <div className={styles.addressField}>
                <div className={styles.profilePrefill}>
                  <strong>Informations reprises depuis ton profil</strong>
                  <span>
                    Tu peux modifier le téléphone ou l’adresse uniquement pour
                    cette livraison.
                  </span>
                </div>

                <label htmlFor="delivery_phone">Numéro de téléphone</label>
                <input
                  id="delivery_phone"
                  name="delivery_phone"
                  type="tel"
                  maxLength={40}
                  defaultValue={profilePhone}
                  placeholder="Exemple : 06 12 34 56 78"
                  autoComplete="tel"
                />

                <label htmlFor="delivery_address">
                  Adresse complète de livraison
                </label>
                <textarea
                  id="delivery_address"
                  name="delivery_address"
                  maxLength={500}
                  rows={4}
                  defaultValue={profileAddress}
                  placeholder="Exemple : 12 rue de Locmaria, résidence Nostra, bâtiment B"
                  autoComplete="street-address"
                />

                <small>
                  Les informations saisies ici seront enregistrées avec la
                  commande et transmises à l’équipe chargée de la livraison.
                </small>

                {(!profilePhone || !profileAddress) && (
                  <small>
                    Ton profil est incomplet. Tu peux remplir les champs ici ou{" "}
                    <Link href="/profil">compléter ton identité</Link>.
                  </small>
                )}
              </div>
            </>
          )}

          <div className={styles.summary}>
            <div>
              <span>{isRentalCatalog ? "Tarif de location" : "Prix total du véhicule"}</span>
              <strong>{formatPrice(vehiclePrice)}</strong>
            </div>
            {canReserve && (
              <>
                <div>
                  <span>Acompte de réservation (15 %)</span>
                  <strong>{formatPrice(depositAmount)}</strong>
                </div>
                <div>
                  <span>Solde après validation (85 %)</span>
                  <strong>{formatPrice(balanceAmount)}</strong>
                </div>
              </>
            )}
            <div>
              <span>{isRentalCatalog ? "Retrait en concession" : "Retrait au showroom"}</span>
              <strong>{isRentalCatalog ? "Obligatoire" : "Gratuit"}</strong>
            </div>
            {!isRentalCatalog && !isHeavyVehicle && (
              <div>
                <span>Option domicile</span>
                <strong>
                  + {formatPrice(HOME_DELIVERY_PRICE)} par camion
                </strong>
              </div>
            )}
          </div>

          <p className={styles.notice}>
            {isRentalCatalog
              ? canOrder
                ? "Ce véhicule est proposé uniquement à la location. Après ajout au panier, le retrait se fera obligatoirement à la concession Nostra Motors."
                : "La location de ce véhicule est temporairement indisponible."
              : canReserve && canOrder
                ? "Choisis entre la réservation avec 15 % d’acompte et la commande directe au prix total."
                : canReserve
                  ? "Seule la réservation avec 15 % d’acompte est autorisée pour ce véhicule."
                  : canOrder
                    ? "Seule la commande directe au prix total est autorisée pour ce véhicule."
                    : "Aucune nouvelle réservation ou commande n’est actuellement autorisée pour ce véhicule."}
            {!isRentalCatalog &&
              (isHeavyVehicle
                ? " La livraison à domicile reste désactivée pour l’intégralité du catalogue poids lourd."
                : canPurchase
                  ? " Une éventuelle livraison à domicile sera ajoutée au paiement concerné."
                  : "")}
          </p>

          {isRentalCatalog && canOrder && (
            <Link className={styles.submit} href={`/motors/location/${vehicle.id}`} style={{display:"flex",textDecoration:"none",marginBottom:10}}>
              Choisir mes dates de location
            </Link>
          )}

          <button
            className={styles.submit}
            type="submit"
            disabled={stock <= 0 || !canOrderUsedVehicle || !canPurchase}
          >
            {stock > 0 && canOrderUsedVehicle && canPurchase
              ? isRentalCatalog
                ? "Ajouter au panier"
                : financingEligible
                  ? "Valider mon choix"
                  : canReserve && canOrder
                    ? "Ajouter le choix au panier"
                    : canReserve
                      ? "Ajouter la réservation au panier"
                      : "Ajouter la commande au panier"
              : usedStatus === "reserved"
                ? "Véhicule déjà réservé"
                : usedStatus === "sold"
                  ? "Véhicule vendu"
                  : "Véhicule indisponible"}
          </button>
        </form>
        {stock <= 0 && (
          <form action={joinVehicleWaitlistV155} className={styles.deliveryCard}>
            <input type="hidden" name="vehicle_id" value={vehicle.id} />
            <input type="hidden" name="reason" value={isRentalCatalog ? "rental" : "stock"} />
            <p className={styles.eyebrow}>LISTE D’ATTENTE</p>
            <h2>Être prévenu dès qu’il revient</h2>
            <p>Le site t’enverra automatiquement une notification lorsque ce véhicule sera de nouveau disponible.</p>
            <button className={styles.submit} type="submit">Rejoindre la liste d’attente</button>
          </form>
        )}
      </div>
    </article>
  );
}
