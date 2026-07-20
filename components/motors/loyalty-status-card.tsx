import { getLoyaltyStatus } from "@/lib/nostra-motors/loyalty";
import styles from "./v41.module.css";

type Props = {
  purchaseCount: number;
};

export function LoyaltyStatusCard({ purchaseCount }: Props) {
  const status = getLoyaltyStatus(purchaseCount);

  return (
    <section className={styles.card}>
      <span className={styles.eyebrow}>NOSTRA PRIVILÈGE</span>
      <h2>{status.label}</h2>
      <p>
        {purchaseCount} achat{purchaseCount > 1 ? "s" : ""} enregistré{purchaseCount > 1 ? "s" : ""}.
      </p>
      <div
        aria-label={`Progression fidélité : ${status.progressPercent} %`}
        style={{
          background: "#292a30",
          borderRadius: 999,
          height: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "#d4af37",
            height: "100%",
            width: `${status.progressPercent}%`,
          }}
        />
      </div>
      {status.nextLabel ? (
        <p className={styles.muted}>
          Encore {status.purchasesRemaining} achat{status.purchasesRemaining > 1 ? "s" : ""} pour atteindre {status.nextLabel}.
        </p>
      ) : (
        <p className={styles.muted}>Niveau maximal Black Signature atteint.</p>
      )}
    </section>
  );
}
