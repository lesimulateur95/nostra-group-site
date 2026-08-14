"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./v161-logistics.module.css";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function VehicleHoldCountdownV161({
  expiresAt,
  vehicleCount,
}: {
  expiresAt: string;
  vehicleCount: number;
}) {
  const router = useRouter();
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const update = () => {
      const next = Math.max(0, target - Date.now());
      setRemaining(next);
      if (next <= 0) {
        window.setTimeout(() => router.refresh(), 500);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [router, target]);

  const urgent = remaining <= 5 * 60 * 1000;
  return (
    <div className={`${styles.holdBanner} ${urgent ? styles.holdBannerUrgent : ""}`}>
      <div>
        <span>RÉSERVATION TEMPORAIRE DU STOCK</span>
        <strong>
          {vehicleCount} véhicule{vehicleCount > 1 ? "s" : ""} bloqué{vehicleCount > 1 ? "s" : ""} pour ton panier
        </strong>
        <small>
          Tant que le compteur tourne, ces véhicules ne peuvent pas être pris par un autre citoyen.
        </small>
      </div>
      <b>{formatRemaining(remaining)}</b>
    </div>
  );
}
