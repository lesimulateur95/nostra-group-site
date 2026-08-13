"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CasinoCashierPackage } from "@/lib/casino/types";
import styles from "./casino.module.css";

function n(value: number): string {
  return Math.trunc(value).toLocaleString("fr-FR");
}

function packageTotals(item: CasinoCashierPackage, rpPerChip: number) {
  const bonus = Math.floor(item.chipAmount * item.bonusPercent / 100);
  return {
    rpAmount: item.chipAmount * rpPerChip,
    bonus,
    totalChips: item.chipAmount + bonus,
  };
}

export function CasinoCashier({
  rpPerChip,
  minimum,
  maximum,
  rpBalance,
  paymentStatus,
  packages,
}: {
  rpPerChip: number;
  minimum: number;
  maximum: number;
  rpBalance: number | null;
  paymentStatus: "connected" | "not_configured" | "identity_missing" | "not_found" | "unavailable";
  packages: CasinoCashierPackage[];
}) {
  const minRp = minimum * rpPerChip;
  const maxRp = maximum * rpPerChip;
  const [customRp, setCustomRp] = useState(minRp);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const customChips = useMemo(() => {
    if (rpPerChip < 1 || customRp < 1) return 0;
    return Math.floor(customRp / rpPerChip);
  }, [customRp, rpPerChip]);

  const customValid = customRp >= minRp && customRp <= maxRp && customRp % rpPerChip === 0;

  function buy(payload: { packageId?: string; rpAmount?: number }, key: string) {
    setMessage(null);
    setPendingKey(key);
    startTransition(async () => {
      try {
        const response = await fetch("/api/casino/conversion", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, promoCode: promoCode.trim() || undefined, requestId: crypto.randomUUID() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage({ kind: "error", text: result.error ?? "L’achat n’a pas pu être enregistré." });
          return;
        }
        setMessage({
          kind: "success",
          text: `${Number(result.rpDebited ?? payload.rpAmount ?? 0).toLocaleString("fr-FR")} $RP débités · ${Number(result.chipsCredited ?? 0).toLocaleString("fr-FR")} jetons crédités.`,
        });
        router.refresh();
      } finally {
        setPendingKey(null);
      }
    });
  }

  const statusMessage = paymentStatus === "identity_missing"
    ? "Associe ton compte Steam pour utiliser la caisse."
    : paymentStatus === "not_found"
      ? "Ton personnage n’a pas été trouvé dans la base RP."
      : paymentStatus === "not_configured"
        ? "La liaison avec l’argent RP n’est pas encore activée."
        : "La banque RP est temporairement indisponible.";

  return (
    <div className={styles.cashierShop}>
      <section className={styles.cashierExchangePanel} style={{marginBottom: 24}}>
        <p className={styles.cashierMiniTitle}>· CODE PROMOTIONNEL NOSTRA ·</p>
        <label className={styles.cashierField}>
          <span>Code promo facultatif</span>
          <input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} maxLength={40} placeholder="EX. NOSTRA10" />
        </label>
        <small>Le code est vérifié au moment du paiement. Les codes « Groupe » et « Nostra Cercle » sont acceptés.</small>
      </section>
      <div className={styles.cashierPackageGrid}>
        {packages.map((item) => {
          const totals = packageTotals(item, rpPerChip);
          const insufficient = rpBalance !== null && totals.rpAmount > rpBalance;
          const disabled = pending || paymentStatus !== "connected" || insufficient;
          return (
            <article className={styles.cashierPackCard} key={item.id}>
              <div className={styles.cashierCoin} aria-hidden="true">
                <span>{n(totals.totalChips)}</span>
              </div>
              <div className={styles.cashierPackCopy}>
                <h3>{item.name}</h3>
                <p>{n(totals.rpAmount)} $RP → <strong>{n(totals.totalChips)} JT</strong></p>
                {item.bonusPercent > 0 ? (
                  <small>+{item.bonusPercent.toLocaleString("fr-FR")} % bonus · +{n(totals.bonus)} JT</small>
                ) : (
                  <small>Taux officiel · sans bonus</small>
                )}
              </div>
              <button
                className={styles.cashierPackButton}
                disabled={disabled}
                onClick={() => buy({ packageId: item.id }, `pack-${item.id}`)}
                type="button"
              >
                {pendingKey === `pack-${item.id}`
                  ? "PAIEMENT…"
                  : insufficient
                    ? "FONDS RP INSUFFISANTS"
                    : `ACHETER · ${n(totals.rpAmount)} $RP`}
              </button>
            </article>
          );
        })}
      </div>

      <div className={styles.cashierExchangeGrid}>
        <section className={styles.cashierExchangePanel}>
          <p className={styles.cashierMiniTitle}>· ACHAT PERSONNALISÉ</p>
          <label className={styles.cashierField} htmlFor="cashier-custom-rp">
            <span>Montant en $RP</span>
            <input
              id="cashier-custom-rp"
              type="number"
              min={minRp}
              max={maxRp}
              step={rpPerChip}
              value={customRp}
              onChange={(event) => setCustomRp(Math.max(0, Math.trunc(Number(event.target.value))))}
            />
          </label>
          <div className={styles.cashierEquation}>{n(customRp)} $RP <b>⇄</b> <strong>{n(customChips)} JT</strong></div>
          {!customValid && <p className={styles.cashierInlineError}>Le montant doit être un multiple de {n(rpPerChip)} $RP et rester dans les limites de la caisse.</p>}
          <button
            className={styles.cashierCustomButton}
            disabled={pending || paymentStatus !== "connected" || !customValid || (rpBalance !== null && customRp > rpBalance)}
            onClick={() => buy({ rpAmount: customRp }, "custom")}
            type="button"
          >
            {pendingKey === "custom" ? "PAIEMENT SÉCURISÉ…" : "ACHETER"}
          </button>
        </section>

        <section className={styles.cashierBalancePanel}>
          <p className={styles.cashierMiniTitle}>· DISPONIBILITÉS</p>
          <div><span>Argent RP disponible</span><strong>{paymentStatus === "connected" && rpBalance !== null ? `${n(rpBalance)} $RP` : "INDISPONIBLE"}</strong></div>
          <div><span>Taux officiel</span><strong>1 JT = {n(rpPerChip)} $RP</strong></div>
          <small>Les achats sont débités directement sur l’argent RP de ton personnage. Aucun jeton n’est créé si le débit échoue.</small>
        </section>
      </div>

      {paymentStatus !== "connected" && <div className={`${styles.notice} ${styles.error}`}>{statusMessage}</div>}
      {message && <div className={`${styles.notice} ${styles[message.kind]}`}>{message.text}</div>}
    </div>
  );
}
