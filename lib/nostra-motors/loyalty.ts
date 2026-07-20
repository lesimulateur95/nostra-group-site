export type LoyaltyLevel = "standard" | "silver" | "gold" | "black_signature";

export type LoyaltyStatus = {
  key: LoyaltyLevel;
  label: string;
  minimumPurchases: number;
  nextLevel: Exclude<LoyaltyLevel, "standard"> | null;
  nextLabel: string | null;
  purchasesRemaining: number;
  progressPercent: number;
};

const LEVELS = [
  { key: "silver" as const, label: "Silver", minimumPurchases: 10 },
  { key: "gold" as const, label: "Gold", minimumPurchases: 30 },
  {
    key: "black_signature" as const,
    label: "Black Signature",
    minimumPurchases: 50,
  },
];

export const LOYALTY_THRESHOLDS = {
  silver: 10,
  gold: 30,
  blackSignature: 50,
} as const;

export function getLoyaltyStatus(purchaseCount: number): LoyaltyStatus {
  const purchases = Math.max(0, Math.floor(Number(purchaseCount) || 0));

  const current = [...LEVELS]
    .reverse()
    .find((level) => purchases >= level.minimumPurchases);

  const next = LEVELS.find((level) => purchases < level.minimumPurchases) ?? null;
  const previousMinimum = current?.minimumPurchases ?? 0;
  const nextMinimum = next?.minimumPurchases ?? previousMinimum;
  const progressRange = Math.max(1, nextMinimum - previousMinimum);
  const progress = next
    ? Math.min(100, Math.max(0, ((purchases - previousMinimum) / progressRange) * 100))
    : 100;

  return {
    key: current?.key ?? "standard",
    label: current?.label ?? "Standard",
    minimumPurchases: current?.minimumPurchases ?? 0,
    nextLevel: next?.key ?? null,
    nextLabel: next?.label ?? null,
    purchasesRemaining: next ? Math.max(0, next.minimumPurchases - purchases) : 0,
    progressPercent: Math.round(progress),
  };
}
