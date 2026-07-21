"use client";

import { usePathname, useSearchParams } from "next/navigation";

import {
  checkoutPlateOrder,
  removePlateCart,
  saveLoyaltyPreference,
} from "@/app/actions/loyalty";
import type { LoyaltyState } from "@/lib/loyalty/data";
import styles from "@/components/loyalty/loyalty.module.css";

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function ProfileLoyaltyPanelClient({
  state,
}: {
  state: LoyaltyState;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname !== "/profil") return null;

  const catalogDiscount =
    state.tier?.catalog_discount_percent ?? 0;
  const plateDiscount =
    state.tier?.plate_discount_percent ?? 0;

  const plateTotal = state.plate_cart
    ? Math.round(
        state.plate_cart.base_price *
          (100 -
            (state.preferences.apply_plate_discount
              ? plateDiscount
              : 0)) /
          100,
      )
    : 0;

  return (
    <section className={styles.profilePanel}>
      <header className={styles.panelHeader}>
        <div>
          <span>FIDÉLITÉ & PLAQUES</span>
          <h2>Mes remises sélectionnables</h2>
          <p>
            Les remises catalogue s’appliquent uniquement aux
            véhicules. Les frais de livraison et les autres avantages
            ne sont pas transformés automatiquement en réduction.
          </p>
        </div>

        <div className={styles.tierBadge}>
          <span>MON GRADE</span>
          <strong>{state.tier?.label ?? "Aucun grade"}</strong>
        </div>
      </header>

      {searchParams.get("loyalty_saved") && (
        <div className={styles.success}>
          Ton choix de remise a été enregistré.
        </div>
      )}

      {searchParams.get("plate_added") && (
        <div className={styles.success}>
          La plaque a été ajoutée à ton panier.
        </div>
      )}

      {searchParams.get("plate_order_sent") && (
        <div className={styles.success}>
          Commande de plaque{" "}
          <strong>
            {searchParams.get("plate_order_sent")}
          </strong>{" "}
          envoyée à Nostra Motors.
        </div>
      )}

      {(searchParams.get("loyalty_error") ||
        searchParams.get("plate_error")) && (
        <div className={styles.error}>
          L’action n’a pas pu être enregistrée.
        </div>
      )}

      {!state.configured && (
        <div className={styles.error}>
          Le module V48 doit être activé dans Supabase.
        </div>
      )}

      <div className={styles.preferenceGrid}>
        <article className={styles.preferenceCard}>
          <span>COMMANDE CATALOGUE</span>
          <h3>
            Remise véhicules : {catalogDiscount} %
          </h3>

          <p>
            Sous-total véhicules :{" "}
            {money(state.catalog_cart.vehicle_subtotal)}
            <br />
            Livraison non remisée :{" "}
            {money(state.catalog_cart.delivery_subtotal)}
          </p>

          {state.tier && catalogDiscount > 0 ? (
            <form action={saveLoyaltyPreference}>
              <input
                type="hidden"
                name="kind"
                value="catalog"
              />
              <input
                type="hidden"
                name="enabled"
                value={
                  state.preferences.apply_catalog_discount
                    ? "false"
                    : "true"
                }
              />

              <button type="submit">
                {state.preferences.apply_catalog_discount
                  ? "Ne pas appliquer la remise"
                  : `Appliquer ma remise de ${catalogDiscount} %`}
              </button>
            </form>
          ) : (
            <p className={styles.muted}>
              La Direction doit d’abord t’attribuer une carte de
              fidélité.
            </p>
          )}

          {state.preferences.apply_catalog_discount && (
            <strong className={styles.estimate}>
              Total estimé véhicules :{" "}
              {money(
                state.catalog_cart
                  .discounted_vehicle_subtotal,
              )}
            </strong>
          )}
        </article>

        <article className={styles.preferenceCard}>
          <span>COMMANDE DE PLAQUE</span>

          {!state.plate_cart ? (
            <>
              <h3>Aucune plaque dans le panier</h3>
              <a href="/motors/plaques">
                Commander une nouvelle plaque →
              </a>
            </>
          ) : (
            <>
              <h3>{state.plate_cart.plate_text}</h3>
              <p>
                Véhicule : {state.plate_cart.vehicle_label}
                <br />
                Tarif normal :{" "}
                {money(state.plate_cart.base_price)}
              </p>

              {state.tier && plateDiscount > 0 && (
                <form action={saveLoyaltyPreference}>
                  <input
                    type="hidden"
                    name="kind"
                    value="plate"
                  />
                  <input
                    type="hidden"
                    name="enabled"
                    value={
                      state.preferences.apply_plate_discount
                        ? "false"
                        : "true"
                    }
                  />

                  <button type="submit">
                    {state.preferences.apply_plate_discount
                      ? "Retirer la remise plaque"
                      : plateDiscount >= 100
                        ? "Utiliser ma plaque offerte"
                        : `Appliquer ${plateDiscount} % sur la plaque`}
                  </button>
                </form>
              )}

              <div className={styles.plateTotal}>
                <span>Total de la plaque</span>
                <strong>{money(plateTotal)}</strong>
              </div>

              <div className={styles.actionRow}>
                <form action={checkoutPlateOrder}>
                  <button type="submit">
                    Commander la plaque
                  </button>
                </form>

                <form action={removePlateCart}>
                  <button
                    className={styles.danger}
                    type="submit"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
