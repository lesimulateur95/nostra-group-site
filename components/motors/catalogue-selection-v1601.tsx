"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { addVehicleSelectionToCartV1601 } from "@/app/actions/catalogue-selection-v1601";
import type { DeliveryAddressV161 } from "@/lib/nostra-motors/v161-data";
import styles from "./catalogue-selection-v1601.module.css";

const STORAGE_KEY = "nostra-motors-vehicle-selection-v1601";

export type CatalogueSelectionItemV1601 = {
  id: number;
  label: string;
  price: number;
  imageUrl?: string | null;
  catalogType: string;
};

type SelectionContextValue = {
  items: CatalogueSelectionItemV1601[];
  has: (id: number) => boolean;
  toggle: (item: CatalogueSelectionItemV1601) => void;
  addMany: (items: CatalogueSelectionItemV1601[]) => void;
  remove: (id: number) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function readStorage(): CatalogueSelectionItemV1601[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: Number(item.id),
        label: String(item.label ?? "Véhicule"),
        price: Math.max(0, Number(item.price) || 0),
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
        catalogType: String(item.catalogType ?? "standard"),
      }))
      .filter((item) => Number.isFinite(item.id) && item.id > 0)
      .filter((item) => item.catalogType !== "concession");
  } catch {
    return [];
  }
}

function transportLabel(count: number): string {
  const safeCount = Math.max(0, Math.floor(count));
  let carrier = Math.floor(safeCount / 5);
  let semi = 0;
  let plateau = 0;
  const remainder = safeCount % 5;

  if (remainder === 1) plateau = 1;
  else if (remainder === 2) semi = 1;
  else if (remainder >= 3) carrier += 1;

  const parts: string[] = [];
  if (carrier > 0) parts.push(`${carrier} × camion 5 places`);
  if (semi > 0) parts.push(`${semi} × semi-remorque 2 places`);
  if (plateau > 0) parts.push(`${plateau} × plateau 1 place`);
  return parts.length ? parts.join(" + ") : "Aucun transport nécessaire";
}

function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("Catalogue selection provider missing");
  return value;
}

export function CatalogueSelectionProviderV1601({
  children,
  profilePhone,
  profileAddress,
  deliveryAddresses = [],
}: {
  children: ReactNode;
  profilePhone?: string;
  profileAddress?: string;
  deliveryAddresses?: DeliveryAddressV161[];
}) {
  const pathname = usePathname();
  const [items, setItems] = useState<CatalogueSelectionItemV1601[]>([]);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"showroom" | "home">(
    "showroom",
  );
  const defaultDeliveryAddress =
    deliveryAddresses.find((address) => address.is_default) ?? deliveryAddresses[0] ?? null;
  const [deliveryAddressId, setDeliveryAddressId] = useState<string>(
    defaultDeliveryAddress ? String(defaultDeliveryAddress.id) : "manual",
  );
  const selectedDeliveryAddress =
    deliveryAddresses.find((address) => String(address.id) === deliveryAddressId) ?? null;
  const selectedDeliveryAddressText = selectedDeliveryAddress
    ? [selectedDeliveryAddress.address_line, selectedDeliveryAddress.city, selectedDeliveryAddress.zone]
        .filter(Boolean)
        .join(", ")
    : "";

  useEffect(() => {
    setItems(readStorage());
    setReady(true);

    const sync = () => setItems(readStorage());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const has = useCallback(
    (id: number) => items.some((item) => item.id === id),
    [items],
  );

  const toggle = useCallback((item: CatalogueSelectionItemV1601) => {
    setItems((current) =>
      current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [...current, item],
    );
  }, []);

  const addMany = useCallback((newItems: CatalogueSelectionItemV1601[]) => {
    setItems((current) => {
      const map = new Map(current.map((item) => [item.id, item]));
      for (const item of newItems) {
        if (item.catalogType !== "concession") map.set(item.id, item);
      }
      return [...map.values()];
    });
  }, []);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDialogOpen(false);
  }, []);

  const value = useMemo(
    () => ({ items, has, toggle, addMany, remove, clear }),
    [items, has, toggle, addMany, remove, clear],
  );

  const total = items.reduce((sum, item) => sum + item.price, 0);
  const homeEligibleItems = items.filter(
    (item) => !["concession", "heavy"].includes(item.catalogType),
  );
  const excludedHomeItems = items.length - homeEligibleItems.length;
  const homeEligibleValue = homeEligibleItems.reduce(
    (sum, item) => sum + item.price,
    0,
  );
  const deliveryFee = Math.round(homeEligibleValue * 0.05 * 100) / 100;
  const finalTotal = total + (deliveryMode === "home" ? deliveryFee : 0);

  useEffect(() => {
    if (homeEligibleItems.length === 0 && deliveryMode === "home") {
      setDeliveryMode("showroom");
    }
  }, [homeEligibleItems.length, deliveryMode]);

  return (
    <SelectionContext.Provider value={value}>
      {children}

      {ready && items.length > 0 && (
        <div className={styles.bar} aria-live="polite">
          <div className={styles.barInner}>
            <div className={styles.barCopy}>
              <strong>
                {items.length} véhicule{items.length > 1 ? "s" : ""} sélectionné
                {items.length > 1 ? "s" : ""}
              </strong>
              <span>Valeur estimée : {money(total)} · la sélection reste mémorisée entre les catalogues.</span>
            </div>
            <div className={styles.barActions}>
              <button className={styles.clearButton} type="button" onClick={clear}>
                Vider
              </button>
              <button
                className={styles.commandButton}
                type="button"
                onClick={() => setDialogOpen(true)}
              >
                Commander ma sélection
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogOpen && items.length > 0 && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="selection-v1601-title">
            <div className={styles.dialogHeader}>
              <div>
                <p>COMMANDE GROUPÉE NOSTRA MOTORS</p>
                <h2 id="selection-v1601-title">Préparer {items.length} véhicule{items.length > 1 ? "s" : ""}</h2>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setDialogOpen(false)} aria-label="Fermer">
                ×
              </button>
            </div>

            <form action={addVehicleSelectionToCartV1601} className={styles.dialogBody}>
              <input type="hidden" name="vehicle_ids" value={JSON.stringify(items.map((item) => item.id))} />
              <input type="hidden" name="return_path" value={pathname || "/motors/catalogue"} />

              <div className={styles.selectionList}>
                {items.map((item) => (
                  <div className={styles.selectionRow} key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{money(item.price)}</span>
                    <button className={styles.removeButton} type="button" onClick={() => remove(item.id)}>
                      Retirer
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span>Véhicules</span>
                  <strong>{items.length}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Total véhicules</span>
                  <strong>{money(total)}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Total avec option choisie</span>
                  <strong>{money(finalTotal)}</strong>
                </div>
              </div>

              <section className={styles.deliverySection}>
                <h3 className={styles.deliveryTitle}>Mode de récupération</h3>
                <label className={styles.option}>
                  <input
                    type="radio"
                    name="delivery_mode"
                    value="showroom"
                    checked={deliveryMode === "showroom"}
                    onChange={() => setDeliveryMode("showroom")}
                  />
                  <span className={styles.optionCopy}>
                    <strong>Retrait chez Nostra Motors</strong>
                    <small>Aucun frais de livraison n’est ajouté.</small>
                  </span>
                  <span className={styles.optionPrice}>Gratuit</span>
                </label>

                <label className={styles.option}>
                  <input
                    type="radio"
                    name="delivery_mode"
                    value="home"
                    checked={deliveryMode === "home"}
                    disabled={homeEligibleItems.length === 0}
                    onChange={() => setDeliveryMode("home")}
                  />
                  <span className={styles.optionCopy}>
                    <strong>Livraison à domicile</strong>
                    <small>5 % de la valeur globale des véhicules éligibles à la livraison.</small>
                  </span>
                  <span className={styles.optionPrice}>+ {money(deliveryFee)}</span>
                </label>

                {deliveryMode === "home" && (
                  <>
                    <div className={styles.transportBox}>
                      <strong>Transport prévu :</strong> {transportLabel(homeEligibleItems.length)}.
                      {excludedHomeItems > 0 && (
                        <div className={styles.warning}>
                          {excludedHomeItems} poids lourd{excludedHomeItems > 1 ? "s" : ""} reste{excludedHomeItems > 1 ? "nt" : ""} en retrait showroom.
                        </div>
                      )}
                    </div>
                    <div className={styles.homeFields}>
                      {deliveryAddresses.length > 0 && (
                        <label>
                          Adresse enregistrée
                          <select value={deliveryAddressId} onChange={(event) => setDeliveryAddressId(event.target.value)}>
                            {deliveryAddresses.map((address) => (
                              <option key={address.id} value={address.id}>
                                {address.label}{address.is_default ? " · Par défaut" : ""}
                              </option>
                            ))}
                            <option value="manual">Autre adresse</option>
                          </select>
                        </label>
                      )}
                      {selectedDeliveryAddress ? (
                        <>
                          <label>
                            Téléphone
                            <input name="delivery_phone" type="tel" readOnly value={selectedDeliveryAddress.phone || profilePhone || ""} />
                          </label>
                          <label>
                            Adresse complète
                            <textarea name="delivery_address" rows={2} readOnly value={selectedDeliveryAddressText} />
                          </label>
                        </>
                      ) : (
                        <>
                          <label>
                            Téléphone
                            <input name="delivery_phone" type="tel" maxLength={40} defaultValue={profilePhone ?? ""} placeholder="06 12 34 56 78" />
                          </label>
                          <label>
                            Adresse complète
                            <textarea name="delivery_address" rows={2} maxLength={500} defaultValue={profileAddress ?? ""} placeholder="Adresse, résidence, bâtiment…" />
                          </label>
                        </>
                      )}
                      <Link href="/profil/adresses">Gérer mes adresses de livraison</Link>
                    </div>
                  </>
                )}
              </section>

              <div className={styles.submitRow}>
                <button className={styles.clearButton} type="button" onClick={() => setDialogOpen(false)}>
                  Continuer mes choix
                </button>
                <button className={styles.submitButton} type="submit">
                  Continuer vers le panier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SelectionContext.Provider>
  );
}

export function CatalogueSelectionButtonV1601({
  item,
  optionsHref,
}: {
  item: CatalogueSelectionItemV1601;
  optionsHref: string;
}) {
  const { has, toggle } = useSelection();
  const selected = has(item.id);

  return (
    <div className={styles.toggleWrap}>
      <button
        className={`${styles.selectButton} ${selected ? styles.selected : ""}`}
        type="button"
        onClick={() => toggle(item)}
      >
        {selected ? "✓ Véhicule sélectionné" : "+ Ajouter à ma sélection"}
      </button>
      <Link className={styles.secondaryLink} href={optionsHref}>
        Options d’achat individuel
      </Link>
    </div>
  );
}

export function CatalogueCollectionSelectionButtonV1601({
  items,
  disabled,
}: {
  items: CatalogueSelectionItemV1601[];
  disabled?: boolean;
}) {
  const { addMany } = useSelection();
  const commandableItems = items.filter((item) => item.catalogType !== "concession");

  return (
    <button
      className={styles.collectionButton}
      type="button"
      disabled={disabled || commandableItems.length !== items.length || items.length === 0}
      onClick={() => addMany(commandableItems)}
    >
      {disabled
        ? "Collection temporairement indisponible"
        : commandableItems.length !== items.length
          ? "Collection avec véhicule Location non groupable"
          : "Sélectionner toute la collection"}
    </button>
  );
}

export function clearCatalogueVehicleSelectionV1601() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Le stockage local peut être désactivé : aucun blocage fonctionnel.
  }
}
