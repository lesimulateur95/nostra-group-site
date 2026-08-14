export const HOME_DELIVERY_RATE_V160 = 0.05;

export type DeliveryTransportPlanV160 = {
  vehicleCount: number;
  plateauCount: number;
  semiCount: number;
  carrierCount: number;
  totalCapacity: number;
};

export function calculateHomeDeliveryFeeV160(vehicleValue: number): number {
  const safeValue = Math.max(0, Number(vehicleValue) || 0);
  return Math.round(safeValue * HOME_DELIVERY_RATE_V160 * 100) / 100;
}

export function calculateDeliveryTransportPlanV160(
  vehicleCount: number,
): DeliveryTransportPlanV160 {
  const count = Math.max(0, Math.floor(Number(vehicleCount) || 0));
  let carrierCount = Math.floor(count / 5);
  let semiCount = 0;
  let plateauCount = 0;
  const remainder = count % 5;

  if (remainder === 1) plateauCount = 1;
  else if (remainder === 2) semiCount = 1;
  else if (remainder >= 3) carrierCount += 1;

  return {
    vehicleCount: count,
    plateauCount,
    semiCount,
    carrierCount,
    totalCapacity: carrierCount * 5 + semiCount * 2 + plateauCount,
  };
}

export function formatDeliveryTransportPlanV160(
  plan: DeliveryTransportPlanV160,
): string {
  const parts: string[] = [];

  if (plan.carrierCount > 0) {
    parts.push(
      `${plan.carrierCount} × camion porte-véhicules 5 places`,
    );
  }
  if (plan.semiCount > 0) {
    parts.push(`${plan.semiCount} × semi-remorque 2 places`);
  }
  if (plan.plateauCount > 0) {
    parts.push(`${plan.plateauCount} × plateau 1 place`);
  }

  return parts.length > 0 ? parts.join(" + ") : "Aucun transport nécessaire";
}
