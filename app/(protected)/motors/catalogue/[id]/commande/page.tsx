/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { addConfiguredCatalogVehicleToCart } from "@/app/actions/catalogue";
import type { CatalogVehicleImage } from "@/lib/backoffice/data";
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
    return typeof candidate.url === "string" && typeof candidate.path === "string";
  });
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
  const { data: vehicle, error } = await supabase
    .from("catalog_vehicles")
    .select("id,brand,model,trunk_capacity,top_speed,power,price,description,images,published,stock_quantity")
    .eq("id", vehicleId)
    .eq("published", true)
    .maybeSingle();

  if (error || !vehicle) notFound();

  const vehicleImages = images(vehicle.images);
  const vehiclePrice = Number(vehicle.price) || 0;
  const stock = Math.max(0, Number(vehicle.stock_quantity) || 0);

  const errorMessage =
    query.error === "stock"
      ? "Ce véhicule n’est plus disponible dans cette quantité."
      : query.error === "setup"
        ? "Le module de livraison doit encore être activé dans Supabase."
        : query.error === "delivery"
          ? "Choisis un mode de livraison valide."
          : query.error === "address"
            ? "Renseigne une adresse de livraison complète pour la livraison à domicile."
            : query.error
              ? "Impossible d’ajouter cette configuration au panier."
              : null;

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CONFIGURATION DE LA COMMANDE</p>
          <h1>{vehicle.brand} {vehicle.model}</h1>
          <p>Vérifie le véhicule, puis choisis son mode de livraison avant de l’ajouter au panier.</p>
        </div>
        <Link className={styles.backLink} href="/motors/catalogue">← Retour au catalogue</Link>
      </header>

      {errorMessage && <div className={styles.error}>{errorMessage}</div>}

      <div className={styles.layout}>
        <section className={styles.vehicleCard}>
          <div className={styles.media}>
            {vehicleImages[0] ? (
              <img src={vehicleImages[0].url} alt={`${vehicle.brand} ${vehicle.model}`} />
            ) : (
              <div className={styles.placeholder}>PHOTO À VENIR</div>
            )}
          </div>

          <div className={styles.vehicleContent}>
            <p className={styles.eyebrow}>{vehicle.brand}</p>
            <h2>{vehicle.model}</h2>
            {vehicle.description && <p className={styles.description}>{vehicle.description}</p>}

            <dl className={styles.specs}>
              <div><dt>Coffre</dt><dd>{vehicle.trunk_capacity || "Non renseigné"}</dd></div>
              <div><dt>Vitesse maximale</dt><dd>{vehicle.top_speed || "Non renseignée"}</dd></div>
              <div><dt>Puissance</dt><dd>{vehicle.power || "Non renseignée"}</dd></div>
              <div><dt>Disponibilité</dt><dd>{stock} en stock</dd></div>
            </dl>

            <div className={styles.vehiclePrice}>
              <span>Prix du véhicule</span>
              <strong>{formatPrice(vehiclePrice)}</strong>
            </div>
          </div>
        </section>

        <form action={addConfiguredCatalogVehicleToCart} className={styles.deliveryCard}>
          <input type="hidden" name="vehicle_id" value={vehicle.id} />

          <div className={styles.deliveryHeading}>
            <p className={styles.eyebrow}>MODE DE LIVRAISON</p>
            <h2>Où souhaites-tu recevoir le véhicule ?</h2>
          </div>

          <label className={styles.option}>
            <input type="radio" name="delivery_mode" value="showroom" defaultChecked />
            <span className={styles.optionIcon}>◆</span>
            <span className={styles.optionText}>
              <strong>Retrait au showroom</strong>
              <small>Le véhicule sera récupéré directement chez Nostra Motors.</small>
            </span>
            <span className={styles.optionPrice}>Gratuit</span>
          </label>

          <label className={styles.option}>
            <input type="radio" name="delivery_mode" value="home" />
            <span className={styles.optionIcon}>🚛</span>
            <span className={styles.optionText}>
              <strong>Livraison à domicile</strong>
              <small>Un camion est mobilisé pour transporter ce véhicule jusqu’à l’adresse indiquée.</small>
            </span>
            <span className={styles.optionPrice}>{formatPrice(HOME_DELIVERY_PRICE)}</span>
          </label>

          <div className={styles.addressField}>
            <label htmlFor="delivery_address">Adresse complète de livraison</label>
            <textarea
              id="delivery_address"
              name="delivery_address"
              maxLength={500}
              rows={4}
              placeholder="Exemple : 12 rue de Locmaria, résidence Nostra, bâtiment B"
            />
            <small>
              Ce champ apparaît avec l’option domicile et devient obligatoire pour valider la livraison.
              L’adresse sera affichée dans le panier et transmise avec la commande.
            </small>
          </div>

          <div className={styles.summary}>
            <div><span>Véhicule</span><strong>{formatPrice(vehiclePrice)}</strong></div>
            <div><span>Livraison showroom</span><strong>Gratuite</strong></div>
            <div><span>Option domicile</span><strong>+ {formatPrice(HOME_DELIVERY_PRICE)} par camion</strong></div>
          </div>

          <p className={styles.notice}>
            En choisissant la livraison à domicile, un second article
            « Livraison à domicile — {vehicle.brand} {vehicle.model} » sera ajouté au panier.
          </p>

          <button className={styles.submit} type="submit" disabled={stock <= 0}>
            {stock > 0 ? "Ajouter cette configuration au panier" : "Véhicule indisponible"}
          </button>
        </form>
      </div>
    </article>
  );
}
