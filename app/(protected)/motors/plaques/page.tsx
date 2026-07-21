import { addPlateToCart } from "@/app/actions/loyalty";
import { getMyLoyaltyState } from "@/lib/loyalty/data";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function PlateOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [state, params] = await Promise.all([
    getMyLoyaltyState(),
    searchParams,
  ]);

  const plateDiscount =
    state.tier?.plate_discount_percent ?? 0;
  const discountedPrice = Math.round(
    state.plate_settings.base_price *
      (100 - plateDiscount) /
      100,
  );

  const errorMessage =
    params.error === "plate"
      ? "La plaque doit contenir entre 2 et 16 caractères : lettres, chiffres, espaces ou tirets."
      : params.error === "vehicle"
        ? "Indique le véhicule concerné."
        : params.error === "closed"
          ? "Les commandes de plaques sont temporairement fermées."
          : params.error
            ? "La plaque n’a pas pu être ajoutée au panier."
            : null;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span>NOSTRA MOTORS · SERVICE PLAQUES</span>
        <h1>Commander une nouvelle plaque</h1>
        <p>
          Prépare ta demande puis retrouve-la dans le panier de ton
          profil. La remise fidélité reste facultative et se choisit
          directement dans le panier.
        </p>
      </section>

      {errorMessage && (
        <div className={styles.error}>{errorMessage}</div>
      )}

      <section className={styles.layout}>
        <form
          action={addPlateToCart}
          className={styles.form}
        >
          <div className={styles.formHeading}>
            <span>NOUVELLE DEMANDE</span>
            <h2>Informations de la plaque</h2>
          </div>

          <label>
            <span>Texte de la nouvelle plaque</span>
            <input
              name="plate_text"
              required
              minLength={2}
              maxLength={16}
              placeholder="Exemple : NM-2026"
            />
          </label>

          <label>
            <span>Véhicule concerné</span>
            <input
              name="vehicle_label"
              required
              minLength={2}
              maxLength={120}
              placeholder="Exemple : Lamborghini Aventador SV"
            />
          </label>

          <label>
            <span>Informations complémentaires</span>
            <textarea
              name="notes"
              rows={5}
              maxLength={1000}
              placeholder="Immatriculation actuelle, finition souhaitée, consignes…"
            />
          </label>

          <button
            type="submit"
            disabled={!state.plate_settings.active}
          >
            Ajouter la plaque au panier
          </button>
        </form>

        <aside className={styles.summary}>
          <span>RÉCAPITULATIF</span>
          <h2>{money(state.plate_settings.base_price)}</h2>
          <p>Tarif normal d’une nouvelle plaque.</p>

          <div>
            <span>Grade fidélité reconnu</span>
            <strong>
              {state.tier?.label ?? "Aucun grade"}
            </strong>
          </div>

          <div>
            <span>Avantage disponible</span>
            <strong>
              {plateDiscount >= 100
                ? "Plaque offerte"
                : plateDiscount > 0
                  ? `${plateDiscount} % sur la plaque`
                  : "Aucune remise"}
            </strong>
          </div>

          {plateDiscount > 0 && (
            <div className={styles.discountPreview}>
              <span>Prix avec avantage</span>
              <strong>{money(discountedPrice)}</strong>
              <small>
                La remise n’est appliquée qu’après sélection dans le
                panier.
              </small>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
