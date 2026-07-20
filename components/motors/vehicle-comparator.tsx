"use client";

import { useMemo, useState } from "react";
import type { CatalogVehicleV41 } from "@/lib/nostra-motors/v41-data";
import styles from "./v41.module.css";

type Props = {
  vehicles: CatalogVehicleV41[];
};

function value(vehicle: CatalogVehicleV41 | undefined, ...keys: string[]): string {
  if (!vehicle) return "—";
  for (const key of keys) {
    const candidate = vehicle[key];
    if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
      return String(candidate);
    }
  }
  return "—";
}

function label(vehicle: CatalogVehicleV41): string {
  return [vehicle.brand ?? vehicle.make, vehicle.model ?? vehicle.name]
    .filter(Boolean)
    .join(" ") || `Véhicule ${vehicle.id}`;
}

export function VehicleComparator({ vehicles }: Props) {
  const initialIds = vehicles.slice(0, 3).map((vehicle) => String(vehicle.id));
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  const selected = useMemo(
    () => selectedIds.map((id) => vehicles.find((vehicle) => String(vehicle.id) === id)),
    [selectedIds, vehicles],
  );

  const rows = [
    ["Prix", ["price"]],
    ["Puissance", ["power", "horsepower", "hp"]],
    ["Vitesse maximale", ["top_speed", "max_speed"]],
    ["Accélération", ["acceleration", "zero_to_hundred"]],
    ["Places", ["seats"]],
    ["Stock", ["quantity", "stock"]],
    ["Catégorie", ["category", "vehicle_type"]],
  ] as const;

  if (vehicles.length < 2) {
    return <div className={styles.empty}>Il faut au moins deux véhicules dans le catalogue pour les comparer.</div>;
  }

  return (
    <section className={styles.comparator}>
      <span className={styles.eyebrow}>COMPARATEUR</span>
      <h2>Compare jusqu’à trois véhicules</h2>
      <p className={styles.muted}>Choisis les modèles pour afficher leurs caractéristiques côte à côte.</p>

      <div className={styles.selectGrid}>
        {[0, 1, 2].map((position) => (
          <div className={styles.field} key={position}>
            <label htmlFor={`compare-${position}`}>Véhicule {position + 1}</label>
            <select
              id={`compare-${position}`}
              value={selectedIds[position] ?? ""}
              onChange={(event) => {
                setSelectedIds((current) => {
                  const next = [...current];
                  next[position] = event.target.value;
                  return next;
                });
              }}
            >
              <option value="">Aucun</option>
              {vehicles.map((vehicle) => (
                <option key={String(vehicle.id)} value={String(vehicle.id)}>
                  {label(vehicle)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div>
        <div className={styles.comparisonRow}>
          <div><strong>Modèle</strong></div>
          {selected.map((vehicle, index) => (
            <div key={index}><strong>{vehicle ? label(vehicle) : "—"}</strong></div>
          ))}
        </div>

        {rows.map(([rowLabel, keys]) => (
          <div className={styles.comparisonRow} key={rowLabel}>
            <div><strong>{rowLabel}</strong></div>
            {selected.map((vehicle, index) => (
              <div key={index}>{value(vehicle, ...keys)}</div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
