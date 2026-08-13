"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import styles from "./vehicle-favorite-controls.module.css";

type VehicleFavoriteControlsProps = {
  vehicleId: number;
  stockQuantity: number;
  initialFavorite?: boolean;
  initialAlert?: boolean;
  refreshOnChange?: boolean;
};

export function VehicleFavoriteControls({
  vehicleId,
  stockQuantity,
  initialFavorite,
  initialAlert,
  refreshOnChange = false,
}: VehicleFavoriteControlsProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(
    typeof initialFavorite === "boolean",
  );
  const [favorite, setFavorite] = useState(initialFavorite ?? false);
  const [stockAlert, setStockAlert] = useState(initialAlert ?? false);
  const [priceAlert, setPriceAlert] = useState(false);
  const [showroomAlert, setShowroomAlert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadState() {
      const { data: authData } = await supabase.auth.getUser();
      if (!active) return;

      const user = authData.user;

      if (!user) {
        setLoaded(true);
        return;
      }

      const { data } = await supabase
        .from("vehicle_favorites")
        .select("stock_alert,price_alert,showroom_alert")
        .eq("user_id", user.id)
        .eq("vehicle_id", vehicleId)
        .maybeSingle();

      if (!active) return;
      setFavorite(Boolean(data));
      setStockAlert(data?.stock_alert === true);
      setPriceAlert(data?.price_alert === true);
      setShowroomAlert(data?.showroom_alert === true);
      setLoaded(true);
    }

    void loadState();

    return () => {
      active = false;
    };
  }, [initialFavorite, supabase, vehicleId]);

  async function getUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  async function toggleFavorite() {
    if (busy) return;

    setBusy(true);
    setMessage(null);

    const userId = await getUserId();
    if (!userId) {
      setMessage("Connecte-toi pour enregistrer tes véhicules favoris.");
      setBusy(false);
      return;
    }

    if (favorite) {
      const { error } = await supabase
        .from("vehicle_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("vehicle_id", vehicleId);

      if (error) {
        setMessage("Impossible de retirer ce véhicule des favoris.");
      } else {
        setFavorite(false);
        setStockAlert(false);
        setPriceAlert(false);
        setShowroomAlert(false);
        setMessage("Véhicule retiré de tes favoris.");
        if (refreshOnChange) router.refresh();
      }
    } else {
      const { error } = await supabase.from("vehicle_favorites").upsert(
        {
          user_id: userId,
          vehicle_id: vehicleId,
          stock_alert: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,vehicle_id" },
      );

      if (error) {
        setMessage("Impossible d’ajouter ce véhicule aux favoris.");
      } else {
        setFavorite(true);
        setMessage("Véhicule ajouté à tes favoris.");
        if (refreshOnChange) router.refresh();
      }
    }

    setBusy(false);
  }

  async function toggleStockAlert() {
    if (busy) return;

    setBusy(true);
    setMessage(null);

    const userId = await getUserId();
    if (!userId) {
      setMessage("Connecte-toi pour activer une alerte de stock.");
      setBusy(false);
      return;
    }

    const nextAlert = !stockAlert;
    const { error } = await supabase.from("vehicle_favorites").upsert(
      {
        user_id: userId,
        vehicle_id: vehicleId,
        stock_alert: nextAlert,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,vehicle_id" },
    );

    if (error) {
      setMessage("Impossible de modifier l’alerte de stock.");
    } else {
      setFavorite(true);
      setStockAlert(nextAlert);
      setMessage(
        nextAlert
          ? "Tu seras prévenu dès le retour en stock."
          : "Alerte de retour en stock désactivée.",
      );
      if (refreshOnChange) router.refresh();
    }

    setBusy(false);
  }

  async function toggleExtraAlert(kind: "price" | "showroom") {
    if (busy) return;
    setBusy(true); setMessage(null);
    const userId = await getUserId();
    if (!userId) { setMessage("Connecte-toi pour gérer tes alertes."); setBusy(false); return; }
    const next = kind === "price" ? !priceAlert : !showroomAlert;
    const payload = { user_id: userId, vehicle_id: vehicleId, [kind === "price" ? "price_alert" : "showroom_alert"]: next, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("vehicle_favorites").upsert(payload, { onConflict: "user_id,vehicle_id" });
    if (error) setMessage("Impossible de modifier cette alerte.");
    else {
      setFavorite(true);
      if (kind === "price") setPriceAlert(next); else setShowroomAlert(next);
      setMessage(next ? (kind === "price" ? "Alerte baisse de prix activée." : "Alerte showroom activée.") : "Alerte désactivée.");
      if (refreshOnChange) router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.actions}>
        <button
          className={`${styles.favoriteButton} ${
            favorite ? styles.favoriteButtonActive : ""
          }`}
          type="button"
          onClick={toggleFavorite}
          disabled={!loaded || busy}
          aria-pressed={favorite}
        >
          <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
          {favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </button>

        {stockQuantity <= 0 && (
          <label className={styles.alertControl}><input type="checkbox" checked={stockAlert} onChange={toggleStockAlert} disabled={!loaded || busy}/><span>Me prévenir au retour en stock</span></label>
        )}
        <label className={styles.alertControl}><input type="checkbox" checked={priceAlert} onChange={() => toggleExtraAlert("price")} disabled={!loaded || busy}/><span>Me prévenir si le prix baisse</span></label>
        <label className={styles.alertControl}><input type="checkbox" checked={showroomAlert} onChange={() => toggleExtraAlert("showroom")} disabled={!loaded || busy}/><span>Me prévenir s’il arrive au showroom</span></label>
      </div>

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
