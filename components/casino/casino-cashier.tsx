"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import styles from "./casino.module.css";

export function CasinoCashier({
  rpPerChip,
  minimum,
  maximum,
  rpBalance,
  paymentStatus,
}: {
  rpPerChip: number;
  minimum: number;
  maximum: number;
  rpBalance: number | null;
  paymentStatus: "connected" | "not_configured" | "identity_missing" | "not_found" | "unavailable";
}) {
  const packages = [1_000, 5_000, 10_000, 25_000].filter((value) => value >= minimum && value <= maximum);
  const [amount, setAmount] = useState(packages[0] ?? minimum);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const rpAmount = useMemo(() => Math.trunc(amount * rpPerChip), [amount, rpPerChip]);

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/casino/conversion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chipAmount: amount,
          requestId: crypto.randomUUID(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ kind: "error", text: result.error ?? "L’achat n’a pas pu être enregistré." });
        return;
      }
      setMessage({ kind: "success", text: `${rpAmount.toLocaleString("fr-FR")} € RP débités et ${amount.toLocaleString("fr-FR")} jetons crédités immédiatement.` });
      router.refresh();
    });
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.packageGrid}>
        {packages.map((value) => (
          <button className={`${styles.packageButton} ${amount === value ? styles.packageSelected : ""}`} type="button" onClick={() => setAmount(value)} key={value}>
            <strong>{value.toLocaleString("fr-FR")} jetons</strong>
            <span>{(value * rpPerChip).toLocaleString("fr-FR")} € RP</span>
          </button>
        ))}
      </div>
      <div className={styles.field}>
        <label htmlFor="chip-amount">Montant personnalisé en jetons</label>
        <input id="chip-amount" type="number" min={minimum} max={maximum} step="100" value={amount} onChange={(event) => setAmount(Math.max(0, Math.trunc(Number(event.target.value))))} />
      </div>
      <div className={styles.notice}>Tu achètes <strong>{amount.toLocaleString("fr-FR")} jetons</strong> pour <strong>{rpAmount.toLocaleString("fr-FR")} € RP</strong>. Le paiement est vérifié et débité directement sur ton argent en jeu.</div>
      {paymentStatus === "connected" && rpBalance !== null && <div className={styles.notice}>Argent RP disponible : <strong>{rpBalance.toLocaleString("fr-FR")} €</strong>.</div>}
      {paymentStatus !== "connected" && <div className={`${styles.notice} ${styles.error}`}>{paymentStatus === "identity_missing" ? "Associe ton compte Steam pour utiliser la caisse." : paymentStatus === "not_found" ? "Ton personnage n’a pas été trouvé dans la base RP." : paymentStatus === "not_configured" ? "La liaison avec l’argent RP n’est pas encore activée." : "La banque RP est temporairement indisponible."}</div>}
      {message && <div className={`${styles.notice} ${styles[message.kind]}`}>{message.text}</div>}
      <button className={styles.goldButton} disabled={pending || paymentStatus !== "connected" || amount < minimum || amount > maximum || (rpBalance !== null && rpAmount > rpBalance)} onClick={submit} type="button">{pending ? "Paiement sécurisé…" : "Acheter les jetons"}</button>
    </div>
  );
}
