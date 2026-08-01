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

export function CasinoCashout({
  enabled,
  rpPerChip,
  minimum,
  maximum,
  chipBalance,
  paymentStatus,
}: {
  enabled: boolean;
  rpPerChip: number;
  minimum: number;
  maximum: number;
  chipBalance: number;
  paymentStatus: PaymentStatus;
}) {
  const upperLimit = Math.min(maximum, chipBalance);
  const packages = [1_000, 5_000, 10_000, 25_000].filter(
    (value) => value >= minimum && value <= upperLimit,
  );
  const [amount, setAmount] = useState(packages[0] ?? Math.min(minimum, upperLimit));
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const rpAmount = useMemo(() => Math.trunc(amount * rpPerChip), [amount, rpPerChip]);
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
        text: `${Number(result.chipsDebited ?? amount).toLocaleString("fr-FR")} jetons revendus : ${Number(result.rpCredited ?? rpAmount).toLocaleString("fr-FR")} € RP crédités sur ton compte bancaire principal en jeu.`,
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
    <div className={styles.formStack}>
      <div className={styles.packageGrid}>
        {packages.map((value) => (
          <button className={`${styles.packageButton} ${styles.cashoutPackage} ${amount === value ? styles.packageSelected : ""}`} type="button" onClick={() => setAmount(value)} key={value}>
            <strong>{value.toLocaleString("fr-FR")} jetons</strong>
            <span>+ {(value * rpPerChip).toLocaleString("fr-FR")} € RP</span>
          </button>
        ))}
      </div>
      <div className={styles.field}>
        <label htmlFor="cashout-chip-amount">Jetons à revendre</label>
        <input id="cashout-chip-amount" type="number" min={minimum} max={upperLimit} step="100" value={amount} onChange={(event) => setAmount(Math.max(0, Math.trunc(Number(event.target.value))))} />
      </div>
      <div className={`${styles.notice} ${styles.cashoutNotice}`}>Tu rends <strong>{amount.toLocaleString("fr-FR")} jetons</strong> et récupères <strong>{rpAmount.toLocaleString("fr-FR")} € RP</strong> sur le compte bancaire principal de ton personnage.</div>
      <div className={styles.notice}>Jetons disponibles : <strong>{chipBalance.toLocaleString("fr-FR")}</strong>.</div>
      {!enabled && <div className={`${styles.notice} ${styles.error}`}>La revente de jetons est actuellement fermée par la Direction.</div>}
      {paymentStatus !== "connected" && <div className={`${styles.notice} ${styles.error}`}>{unavailableMessage}</div>}
      {chipBalance < minimum && <div className={`${styles.notice} ${styles.error}`}>Il faut au moins {minimum.toLocaleString("fr-FR")} jetons pour effectuer une revente.</div>}
      {message && <div className={`${styles.notice} ${styles[message.kind]}`}>{message.text}</div>}
      <button className={styles.cashoutButton} disabled={pending || !canCashout} onClick={submit} type="button">{pending ? "Virement vers le compte en jeu…" : "Revendre mes jetons"}</button>
    </div>
  );
}
