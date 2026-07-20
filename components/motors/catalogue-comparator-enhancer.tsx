"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import styles from "@/components/motors/catalogue-comparator.module.css";

type ComparedVehicle = {
  id: string;
  label: string;
  price: string;
  imageUrl: string | null;
  notes: string[];
};

const STORAGE_KEY = "nostra_motors_catalogue_comparator_v1";
const LIMIT = 5;

function safeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeId(label: string): string {
  return safeText(label).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function findPortalAnchor(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById("catalogue-comparator-anchor");
  if (existing) return existing;

  const main = document.querySelector("main");
  if (!main) return null;

  const hero =
    main.querySelector("section") ??
    main.firstElementChild;

  if (!hero || !hero.parentElement) return null;

  const anchor = document.createElement("div");
  anchor.id = "catalogue-comparator-anchor";
  hero.insertAdjacentElement("afterend", anchor);

  return anchor;
}

function getButtonElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll("button, a")).filter((element) =>
    safeText(element.textContent).toLowerCase().includes("ajouter au panier"),
  ) as HTMLElement[];
}

function pickVehicleContainer(start: HTMLElement): HTMLElement {
  let current: HTMLElement | null = start;

  while (current && current !== document.body) {
    const hasTitle = Boolean(
      current.querySelector("h1, h2, h3, h4, strong"),
    );
    const hasCartButton = Boolean(
      Array.from(current.querySelectorAll("button, a")).find((element) =>
        safeText(element.textContent).toLowerCase().includes("ajouter au panier"),
      ),
    );

    if (hasTitle && hasCartButton) {
      return current;
    }

    current = current.parentElement;
  }

  return start.parentElement ?? start;
}

function extractVehicle(button: HTMLElement): ComparedVehicle | null {
  const container = pickVehicleContainer(button);

  const titleElement = container.querySelector("h1, h2, h3, h4, strong");
  const label = safeText(titleElement?.textContent);

  if (!label) return null;

  const image = container.querySelector("img");
  const imageUrl = image?.getAttribute("src") ?? null;

  const textContent = safeText(container.textContent);
  const priceMatch =
    textContent.match(/\d[\d\s.,]*\s?(?:€|EUR|\$)/i) ??
    textContent.match(/(?:€|EUR|\$)\s?\d[\d\s.,]*/i);

  const price = safeText(priceMatch?.[0]) || "Prix non indiqué";

  const detailPool = Array.from(
    container.querySelectorAll("p, li, small, span"),
  )
    .map((element) => safeText(element.textContent))
    .filter(Boolean)
    .filter((value) => {
      const lower = value.toLowerCase();
      return (
        value !== label &&
        value !== price &&
        !lower.includes("ajouter au panier") &&
        !lower.includes("ajouter au comparateur") &&
        !lower.includes("retirer du comparateur")
      );
    });

  const uniqueNotes = Array.from(new Set(detailPool)).slice(0, 4);

  return {
    id: normalizeId(label),
    label,
    price,
    imageUrl,
    notes: uniqueNotes,
  };
}

function loadComparator(): ComparedVehicle[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ComparedVehicle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveComparator(items: ComparedVehicle[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function CatalogueComparatorEnhancer() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [vehicles, setVehicles] = useState<ComparedVehicle[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAnchor(findPortalAnchor());
    setVehicles(loadComparator());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveComparator(vehicles);
  }, [vehicles, hydrated]);

  const comparedIds = useMemo(
    () => new Set(vehicles.map((vehicle) => vehicle.id)),
    [vehicles],
  );

  useEffect(() => {
    if (!hydrated) return;

    const refreshButtons = () => {
      const buttons = getButtonElements();

      buttons.forEach((button) => {
        const existing = button.parentElement?.querySelector(
          "[data-comparator-button='true']",
        ) as HTMLButtonElement | null;

        const vehicle = extractVehicle(button);
        if (!vehicle) return;

        const isSelected = comparedIds.has(vehicle.id);
        const limitReached = vehicles.length >= LIMIT && !isSelected;

        let compareButton = existing;
        if (!compareButton) {
          compareButton = document.createElement("button");
          compareButton.type = "button";
          compareButton.dataset.comparatorButton = "true";
          compareButton.className = styles.inlineCompareButton;
          button.insertAdjacentElement("afterend", compareButton);

          compareButton.addEventListener("click", () => {
            setVehicles((current) => {
              const exists = current.some((item) => item.id === vehicle.id);

              if (exists) {
                return current.filter((item) => item.id !== vehicle.id);
              }

              if (current.length >= LIMIT) {
                return current;
              }

              return [...current, vehicle];
            });
          });
        }

        compareButton.textContent = isSelected
          ? "Retirer du comparateur"
          : "Ajouter au comparateur";
        compareButton.disabled = limitReached;
        compareButton.setAttribute("aria-pressed", String(isSelected));
      });
    };

    refreshButtons();

    const observer = new MutationObserver(() => {
      refreshButtons();
      setAnchor((current) => current ?? findPortalAnchor());
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [comparedIds, hydrated, vehicles.length]);

  const removeVehicle = (id: string) => {
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
  };

  const clearAll = () => {
    setVehicles([]);
  };

  if (!anchor) return null;

  return createPortal(
    <section className={styles.comparatorPanel}>
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}>NOSTRA MOTORS</span>
          <h2>Comparateur de véhicules</h2>
          <p>
            Ajoute jusqu’à {LIMIT} véhicules depuis le catalogue, retire-les
            ici quand tu veux, puis remplace-les par d’autres modèles.
          </p>
        </div>

        <div className={styles.counterBlock}>
          <strong>
            {vehicles.length} / {LIMIT}
          </strong>
          {vehicles.length > 0 && (
            <button
              className={styles.clearButton}
              onClick={clearAll}
              type="button"
            >
              Vider le comparateur
            </button>
          )}
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className={styles.emptyState}>
          Aucun véhicule sélectionné. Utilise le bouton{" "}
          <strong>Ajouter au comparateur</strong> sur les modèles du catalogue.
        </div>
      ) : (
        <div className={styles.vehicleGrid}>
          {vehicles.map((vehicle) => (
            <article className={styles.vehicleCard} key={vehicle.id}>
              <div className={styles.imageWrap}>
                {vehicle.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vehicle.imageUrl} alt={vehicle.label} />
                ) : (
                  <span>NM</span>
                )}
              </div>

              <div className={styles.vehicleBody}>
                <h3>{vehicle.label}</h3>
                <p className={styles.price}>{vehicle.price}</p>

                {vehicle.notes.length > 0 ? (
                  <ul className={styles.noteList}>
                    {vehicle.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.noDetails}>
                    Détails visibles sur la fiche du véhicule.
                  </p>
                )}

                <button
                  className={styles.removeButton}
                  onClick={() => removeVehicle(vehicle.id)}
                  type="button"
                >
                  Retirer ce véhicule
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>,
    anchor,
  );
}
