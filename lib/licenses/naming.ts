/**
 * Noms publics officiels utilisés partout sur le site.
 * Les anciens libellés restent reconnus uniquement pour réparer les données
 * historiques et empêcher leur réapparition.
 */
export const CIRCUIT_LICENCE_NAME = "Licence Circuit";
export const GT3RS_LICENCE_NAME = "Licence GT3 RS";
export const F1_LICENCE_NAME = "Licence F1";

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const LEGACY_CIRCUIT_NAMES = new Set([
  "licence pilote officielle",
  "licence pilote officiel",
  "licence officielle pilote",
  "licence pilote circuit",
  "licence circuit pilote",
]);

export function normalizeCircuitLicenceName(value: string): string {
  const clean = value.trim();
  const name = normalized(clean);

  if (LEGACY_CIRCUIT_NAMES.has(name) || name === "licence circuit") {
    return CIRCUIT_LICENCE_NAME;
  }

  if (name.includes("gt3")) {
    return GT3RS_LICENCE_NAME;
  }

  if (/\bf1\b/.test(name)) {
    return F1_LICENCE_NAME;
  }

  return clean;
}

export function normalizeCircuitLicenceCategory(
  licenceName: string,
  category: string | null | undefined,
): string | null {
  const normalizedName = normalizeCircuitLicenceName(licenceName);

  if (normalizedName === CIRCUIT_LICENCE_NAME) return "circuit";
  if (normalizedName === GT3RS_LICENCE_NAME) return "gt3rs";
  if (normalizedName === F1_LICENCE_NAME) return "f1";

  const cleanCategory = category?.trim() ?? "";
  if (!cleanCategory) return null;

  const normalizedCategory = normalized(cleanCategory);
  if (["pilot", "pilote", "circuit", "licence circuit"].includes(normalizedCategory)) {
    return "circuit";
  }
  if (normalizedCategory.includes("gt3")) return "gt3rs";
  if (normalizedCategory === "f1") return "f1";

  return cleanCategory;
}
