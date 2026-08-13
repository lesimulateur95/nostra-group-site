"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import styles from "./casino.module.css";

type PaymentStatus =
  | "connected"
  | "not_configured"
  | "identity_missing"
  | "not_found"
  | "unavailable";

function n(value: number): string {
  return Math.trunc(value).toLocaleString("fr-FR");
}

export function CasinoCashout({
  enabled,
  rpPerChip,
  commissionPercent,
  minimum,
  maximum,
  chipBalance,
  paymentStatus,
}: {
  enabled: boolean;
  rpPerChip: number;
  commissionPercent: number;
  minimum: number;
  maximum: number;
  chipBalance: number;
  paymentStatus: PaymentStatus;
}) {
  const upperLimit = Math.min(maximum, chipBalance);
  const [amount, setAmount] = useState(Math.min(Math.max(minimum, 1), Math.max(upperLimit, 1)));
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const grossRp = useMemo(() => Math.max(0, Math.trunc(amount * rpPerChip)), [amount, rpPerChip]);
  const rpAmount = useMemo(
    () => Math.max(0, Math.floor(grossRp * (100 - commissionPercent) / 100)),
    [grossRp, commissionPercent],
  );
  const commissionAmount = Math.max(0, grossRp - rpAmount);
  const canCashout = enabled && paymentStatus === "connected" && amount >= minimum && amount <= upperLimit;

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/casino/cashout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chipAmount: amount,
          requestId: crypto.randomUUID(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ kind: "error", text: result.error ?? "La revente n’a pas pu être finalisée." });
        return;
      }
      setMessage({
        kind: "success",
        text: `${Number(result.chipsDebited ?? amount).toLocaleString("fr-FR")} jetons revendus · ${Number(result.rpCredited ?? rpAmount).toLocaleString("fr-FR")} $RP crédités.`,
      });
      router.refresh();
    });
  }

  const unavailableMessage = paymentStatus === "identity_missing"
    ? "Associe ton compte Steam pour revendre tes jetons."
    : paymentStatus === "not_found"
      ? "Ton personnage n’a pas été trouvé dans la base RP."
      : paymentStatus === "not_configured"
        ? "La liaison avec le compte bancaire en jeu n’est pas encore activée."
        : "La banque RP est temporairement indisponible.";

  return (
    <div className={styles.cashoutShop}>
      <label className={styles.cashierField} htmlFor="cashout-chip-amount">
        <span>Jetons à revendre</span>
        <input
          id="cashout-chip-amount"
          type="number"
          min={minimum}
          max={Math.max(upperLimit, minimum)}
          step="1"
          value={amount}
          onChange={(event) => setAmount(Math.max(0, Math.trunc(Number(event.target.value))))}
        />
      </label>

      <div className={styles.cashierEquation}>{n(amount)} JT <b>⇄</b> <strong>{n(rpAmount)} $RP</strong></div>
      <div className={styles.cashoutBreakdown}>
        <span><small>Valeur brute</small><b>{n(grossRp)} $RP</b></span>
        <span><small>Commission maison</small><b>− {n(commissionAmount)} $RP ({commissionPercent.toLocaleString("fr-FR")} %)</b></span>
        <span><small>Net reversé</small><b>{n(rpAmount)} $RP</b></span>
      </div>

      <p className={styles.cashierBalanceLine}>Jetons disponibles : <strong>{n(chipBalance)} JT</strong></p>
      {!enabled && <div className={`${styles.notice} ${styles.error}`}>La revente de jetons est actuellement fermée par la Direction.</div>}
      {paymentStatus !== "connected" && <div className={`${styles.notice} ${styles.error}`}>{unavailableMessage}</div>}
      {chipBalance < minimum && <div className={`${styles.notice} ${styles.error}`}>Il faut au moins {n(minimum)} jetons pour effectuer une revente.</div>}
      {message && <div className={`${styles.notice} ${styles[message.kind]}`}>{message.text}</div>}
      <button className={styles.cashierSellButton} disabled={pending || !canCashout} onClick={submit} type="button">
        {pending ? "VIREMENT EN COURS…" : "REVENDRE"}
      </button>
    </div>
  );
}
