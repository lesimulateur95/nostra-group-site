"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  CatalogType,
} from "@/lib/catalogues-v51/data";

import styles from "./catalogue-comparator-v51.module.css";

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

function storageKey(
  catalogType: CatalogType,
): string {
  return `nostra_motors_comparator_v51_${catalogType}`;
}

function isComparableVehicle(
  value: unknown,
): value is ComparableVehicleV51 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row =
    value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    typeof row.price === "string" &&
    (
      typeof row.imageUrl === "string" ||
      row.imageUrl === null
    ) &&
    Array.isArray(row.notes)
  );
}

function loadVehicles(
  catalogType: CatalogType,
): ComparableVehicleV51[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        storageKey(catalogType),
      );

    if (!raw) return [];

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isComparableVehicle)
      .map((vehicle) => ({
        ...vehicle,
        notes: vehicle.notes
          .filter(
            (note): note is string =>
              typeof note === "string",
          )
          .slice(0, 5),
      }))
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
  const [vehicles, setVehicles] =
    useState<ComparableVehicleV51[]>([]);
  const [hydrated, setHydrated] =
    useState(false);

  useEffect(() => {
    setVehicles(
      loadVehicles(catalogType),
    );
    setHydrated(true);
  }, [catalogType]);

  useEffect(() => {
    if (
      !hydrated ||
      typeof window === "undefined"
    ) {
      return;
    }

    window.localStorage.setItem(
      storageKey(catalogType),
      JSON.stringify(vehicles),
    );
  }, [
    catalogType,
    hydrated,
    vehicles,
  ]);

  const selectedIds = useMemo(
    () =>
      new Set(
        vehicles.map(
          (vehicle) => vehicle.id,
        ),
      ),
    [vehicles],
  );

  const isSelected = useCallback(
    (id: string) =>
      selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback(
    (
      vehicle: ComparableVehicleV51,
    ) => {
      setVehicles((current) => {
        const alreadySelected =
          current.some(
            (item) =>
              item.id === vehicle.id,
          );

        if (alreadySelected) {
          return current.filter(
            (item) =>
              item.id !== vehicle.id,
          );
        }

        if (
          current.length >= LIMIT
        ) {
          return current;
        }

        return [
          ...current,
          vehicle,
        ];
      });
    },
    [],
  );

  const remove = useCallback(
    (id: string) => {
      setVehicles((current) =>
        current.filter(
          (vehicle) =>
            vehicle.id !== id,
        ),
      );
    },
    [],
  );

  const clear = useCallback(() => {
    setVehicles([]);
  }, []);

  const value = useMemo(
    () => ({
      vehicles,
      isSelected,
      isLimitReached:
        vehicles.length >= LIMIT,
      toggle,
      remove,
      clear,
    }),
    [
      clear,
      isSelected,
      remove,
      toggle,
      vehicles,
    ],
  );

  return (
    <ComparatorContext.Provider
      value={value}
    >
      {children}
    </ComparatorContext.Provider>
  );
}

function useComparator():
  ComparatorContextValue {
  const context =
    useContext(ComparatorContext);

  if (!context) {
    throw new Error(
      "Le comparateur V51 doit être utilisé dans son provider.",
    );
  }

  return context;
}

export function CatalogueCompareButtonV51({
  vehicle,
}: {
  vehicle: ComparableVehicleV51;
}) {
  const comparator =
    useComparator();

  const selected =
    comparator.isSelected(
      vehicle.id,
    );

  const disabled =
    comparator.isLimitReached &&
    !selected;

  return (
    <button
      className={
        selected
          ? styles.removeButton
          : styles.compareButton
      }
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() =>
        comparator.toggle(vehicle)
      }
    >
      {selected
        ? "Retirer du comparateur"
        : disabled
          ? "Comparateur complet"
          : "Ajouter au comparateur"}
    </button>
  );
}

export function CatalogueComparatorPanelV51({
  title,
}: {
  title: string;
}) {
  const comparator =
    useComparator();

  return (
    <section
      className={
        styles.comparatorPanel
      }
      data-v51-comparator-panel="true"
    >
      <header
        className={
          styles.comparatorHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            COMPARATEUR DU CATALOGUE
          </span>

          <h2>{title}</h2>

          <p>
            Ce comparateur contient
            uniquement les véhicules de
            ce catalogue.
          </p>
        </div>

        <div
          className={
            styles.counterBlock
          }
        >
          <strong>
            {
              comparator.vehicles
                .length
            }{" "}
            / {LIMIT}
          </strong>

          {comparator.vehicles
            .length > 0 && (
            <button
              type="button"
              onClick={
                comparator.clear
              }
            >
              Vider
            </button>
          )}
        </div>
      </header>

      {comparator.vehicles.length ===
      0 ? (
        <div
          className={
            styles.empty
          }
        >
          Aucun véhicule sélectionné
          dans ce catalogue.
        </div>
      ) : (
        <div
          className={
            styles.vehicleGrid
          }
        >
          {comparator.vehicles.map(
            (vehicle) => (
              <article
                className={
                  styles.vehicleCard
                }
                key={vehicle.id}
              >
                <div
                  className={
                    styles.vehicleMedia
                  }
                >
                  {vehicle.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        vehicle.imageUrl
                      }
                      alt={
                        vehicle.label
                      }
                    />
                  ) : (
                    <span>NM</span>
                  )}
                </div>

                <div
                  className={
                    styles.vehicleCopy
                  }
                >
                  <h3>
                    {vehicle.label}
                  </h3>

                  <strong>
                    {vehicle.price}
                  </strong>

                  {vehicle.notes.length >
                    0 && (
                    <ul>
                      {vehicle.notes.map(
                        (
                          note,
                          index,
                        ) => (
                          <li
                            key={`${vehicle.id}-${index}`}
                          >
                            {note}
                          </li>
                        ),
                      )}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      comparator.remove(
                        vehicle.id,
                      )
                    }
                  >
                    Retirer
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
