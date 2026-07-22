"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CatalogType } from "@/lib/catalogues-v51/data";

import styles from "./catalogue-v51.module.css";

export type ComparableVehicleV51 = {
  id: string;
  label: string;
  price: string;
  imageUrl: string | null;
  notes: string[];
};

type ComparatorContextValue = {
  vehicles: ComparableVehicleV51[];
  isSelected: (id: string) => boolean;
  isLimitReached: boolean;
  toggle: (vehicle: ComparableVehicleV51) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const LIMIT = 5;

const ComparatorContext =
  createContext<ComparatorContextValue | null>(null);

function storageKey(catalogType: CatalogType): string {
  return `nostra_motors_comparator_v51_${catalogType}`;
}

function loadVehicles(
  catalogType: CatalogType,
): ComparableVehicleV51[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(
      storageKey(catalogType),
    );

    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is ComparableVehicleV51 =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as ComparableVehicleV51).id ===
            "string" &&
          typeof (item as ComparableVehicleV51).label ===
            "string" &&
          typeof (item as ComparableVehicleV51).price ===
            "string" &&
          Array.isArray(
            (item as ComparableVehicleV51).notes,
          ),
      )
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function CatalogueComparatorProviderV51({
  catalogType,
  children,
}: {
  catalogType: CatalogType;
  children: ReactNode;
}) {
  const [vehicles, setVehicles] = useState<
    ComparableVehicleV51[]
  >([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setVehicles(loadVehicles(catalogType));
    setHydrated(true);
  }, [catalogType]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      storageKey(catalogType),
      JSON.stringify(vehicles),
    );
  }, [catalogType, hydrated, vehicles]);

  const selectedIds = useMemo(
    () => new Set(vehicles.map((vehicle) => vehicle.id)),
    [vehicles],
  );

  const value = useMemo<ComparatorContextValue>(
    () => ({
      vehicles,
      isSelected: (id) => selectedIds.has(id),
      isLimitReached: vehicles.length >= LIMIT,
      toggle: (vehicle) => {
        setVehicles((current) => {
          const exists = current.some(
            (item) => item.id === vehicle.id,
          );

          if (exists) {
            return current.filter(
              (item) => item.id !== vehicle.id,
            );
          }

          if (current.length >= LIMIT) {
            return current;
          }

          return [...current, vehicle];
        });
      },
      remove: (id) => {
        setVehicles((current) =>
          current.filter((vehicle) => vehicle.id !== id),
        );
      },
      clear: () => setVehicles([]),
    }),
    [selectedIds, vehicles],
  );

  return (
    <ComparatorContext.Provider value={value}>
      {children}
    </ComparatorContext.Provider>
  );
}

function useComparator(): ComparatorContextValue {
  const context = useContext(ComparatorContext);

  if (!context) {
    throw new Error(
      "CatalogueComparatorV51 doit être utilisé dans son provider.",
    );
  }

  return context;
}

export function CatalogueCompareButtonV51({
  vehicle,
}: {
  vehicle: ComparableVehicleV51;
}) {
  const comparator = useComparator();
  const selected = comparator.isSelected(vehicle.id);
  const disabled =
    comparator.isLimitReached && !selected;

  return (
    <button
      className={styles.compareButton}
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => comparator.toggle(vehicle)}
    >
      {selected
        ? "Retirer du comparateur"
        : "Ajouter au comparateur"}
    </button>
  );
}

export function CatalogueComparatorPanelV51({
  title,
}: {
  title: string;
}) {
  const comparator = useComparator();

  return (
    <section
      className={styles.comparatorPanel}
      aria-label={`Comparateur ${title}`}
    >
      <header className={styles.comparatorHeader}>
        <div>
          <span>COMPARATEUR DU CATALOGUE</span>
          <h2>{title}</h2>
          <p>
            Ce comparateur contient uniquement les véhicules de ce
            catalogue.
          </p>
        </div>

        <div className={styles.comparatorCounter}>
          <strong>
            {comparator.vehicles.length} / {LIMIT}
          </strong>

          {comparator.vehicles.length > 0 && (
            <button
              type="button"
              onClick={comparator.clear}
            >
              Vider
            </button>
          )}
        </div>
      </header>

      {comparator.vehicles.length === 0 ? (
        <div className={styles.comparatorEmpty}>
          Aucun véhicule sélectionné dans ce catalogue.
        </div>
      ) : (
        <div className={styles.comparatorGrid}>
          {comparator.vehicles.map((vehicle) => (
            <article
              className={styles.comparatorCard}
              key={vehicle.id}
            >
              <div className={styles.comparatorImage}>
                {vehicle.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={vehicle.imageUrl}
                    alt={vehicle.label}
                  />
                ) : (
                  <span>NM</span>
                )}
              </div>

              <div className={styles.comparatorBody}>
                <h3>{vehicle.label}</h3>
                <strong>{vehicle.price}</strong>

                <ul>
                  {vehicle.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => comparator.remove(vehicle.id)}
                >
                  Retirer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
