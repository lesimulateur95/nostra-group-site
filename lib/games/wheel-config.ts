export type WheelPrizeKey = string;

export type WheelPrizeType = "bonus" | "loss";

export type WheelSegment = {
  index: number;
  prizeKey: WheelPrizeKey;
  label: string;
  shortLabel: string;
  type: WheelPrizeType;
  color: string;
  textColor: string;
};

const rawSegments: Omit<WheelSegment, "index">[] = [
  { prizeKey: "lost", label: "Perdu", shortLabel: "PERDU", type: "loss", color: "#2b2b2b", textColor: "#f2f2f2" },
  { prizeKey: "paint", label: "Peinture offerte", shortLabel: "PEINTURE", type: "bonus", color: "#c79a22", textColor: "#111111" },
  { prizeKey: "lost", label: "Perdu", shortLabel: "PERDU", type: "loss", color: "#151515", textColor: "#f2f2f2" },
  { prizeKey: "discount_5", label: "-5 % sur la prochaine commande", shortLabel: "-5 %", type: "bonus", color: "#9f7615", textColor: "#ffffff" },
  { prizeKey: "coffee", label: "1 café offert", shortLabel: "CAFÉ", type: "bonus", color: "#6f4b2a", textColor: "#ffffff" },
  { prizeKey: "lost", label: "Perdu", shortLabel: "PERDU", type: "loss", color: "#242424", textColor: "#f2f2f2" },
  { prizeKey: "circuit_lap", label: "1 tour de circuit offert", shortLabel: "1 TOUR", type: "bonus", color: "#1b5e5a", textColor: "#ffffff" },
  { prizeKey: "paint", label: "Peinture offerte", shortLabel: "PEINTURE", type: "bonus", color: "#d6ad3f", textColor: "#111111" },
  { prizeKey: "lost", label: "Perdu", shortLabel: "PERDU", type: "loss", color: "#111111", textColor: "#f2f2f2" },
  { prizeKey: "circuit_10_laps", label: "10 tours de circuit offerts", shortLabel: "10 TOURS", type: "bonus", color: "#7c2e2e", textColor: "#ffffff" },
  { prizeKey: "discount_5", label: "-5 % sur la prochaine commande", shortLabel: "-5 %", type: "bonus", color: "#b0851e", textColor: "#ffffff" },
  { prizeKey: "circuit_5_laps", label: "5 tours de circuit offerts", shortLabel: "5 TOURS", type: "bonus", color: "#2f477d", textColor: "#ffffff" },
  { prizeKey: "lost", label: "Perdu", shortLabel: "PERDU", type: "loss", color: "#303030", textColor: "#f2f2f2" },
  { prizeKey: "silver_card", label: "Carte fidélité Silver", shortLabel: "SILVER", type: "bonus", color: "#bfc5cc", textColor: "#111111" },
  { prizeKey: "coffee", label: "1 café offert", shortLabel: "CAFÉ", type: "bonus", color: "#80583a", textColor: "#ffffff" },
  { prizeKey: "discount_5", label: "-5 % sur la prochaine commande", shortLabel: "-5 %", type: "bonus", color: "#90690e", textColor: "#ffffff" },
  { prizeKey: "circuit_lap", label: "1 tour de circuit offert", shortLabel: "1 TOUR", type: "bonus", color: "#23746e", textColor: "#ffffff" },
  { prizeKey: "lost", label: "Perdu", shortLabel: "PERDU", type: "loss", color: "#1c1c1c", textColor: "#f2f2f2" },
  { prizeKey: "vehicle_test", label: "Essai d’un véhicule de la concession", shortLabel: "ESSAI VL", type: "bonus", color: "#5e3f87", textColor: "#ffffff" },
  { prizeKey: "paint", label: "Peinture offerte", shortLabel: "PEINTURE", type: "bonus", color: "#c99b25", textColor: "#111111" },
  { prizeKey: "circuit_5_laps", label: "5 tours de circuit offerts", shortLabel: "5 TOURS", type: "bonus", color: "#36548f", textColor: "#ffffff" },
  { prizeKey: "discount_10k", label: "-10 000 € sur la prochaine commande", shortLabel: "-10K", type: "bonus", color: "#8b5b18", textColor: "#ffffff" },
  { prizeKey: "discount_10k", label: "-10 000 € sur la prochaine commande", shortLabel: "-10K", type: "bonus", color: "#a36d20", textColor: "#ffffff" },
];

export const DEFAULT_WHEEL_SEGMENTS: WheelSegment[] = rawSegments.map((segment, index) => ({
  ...segment,
  index,
}));

export const DEFAULT_WHEEL_DISABLED_MESSAGE =
  "La roue de la chance est temporairement indisponible. Reviens prochainement pour tenter ta chance.";

export function summarizeWheelPrizes(segments: WheelSegment[]) {
  const counts = new Map<string, number>();
  for (const segment of segments) {
    counts.set(segment.label, (counts.get(segment.label) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count }));
}
