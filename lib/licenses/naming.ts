/**
 * Nom public officiel de la licence générale du Nostra Circuit.
 * Les anciennes appellations restent reconnues afin de corriger les données
 * déjà enregistrées sans modifier les licences F1 et GT3 RS.
 */
export const CIRCUIT_LICENCE_NAME = "Licence Circuit";

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const LEGACY_GENERIC_NAMES = new Set([
  "licence pilote officielle",
  "licence pilote officiel",
  "licence officielle pilote",
]);

export function normalizeCircuitLicenceName(value: string): string {
  const clean = value.trim();
  return LEGACY_GENERIC_NAMES.has(normalized(clean))
    ? CIRCUIT_LICENCE_NAME
    : clean;
}
