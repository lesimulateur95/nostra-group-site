import type { OfficialPilotLicence } from "@/lib/licenses/lifecycle";

export type TeamChampionshipLicence = "f1" | "gt3rs";

export type TeamChampionshipLicenceAccess = {
  championship: TeamChampionshipLicence;
  valid: boolean;
  licenceNumber: string | null;
  licenceName: string | null;
  validUntil: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function matchesChampionship(
  licence: OfficialPilotLicence,
  championship: TeamChampionshipLicence,
): boolean {
  const code = normalize(licence.renewalLicenseCode);
  const name = normalize(licence.licence_name);

  if (championship === "f1") {
    return code === "F1" || name.includes("F1") || name.includes("FORMULE1");
  }

  return code.includes("GT3") || name.includes("GT3");
}

function isCurrentlyValid(licence: OfficialPilotLicence): boolean {
  return licence.lifecycle.status === "active" || licence.lifecycle.status === "expiring_soon";
}

export function getTeamChampionshipLicenceAccess(
  licences: OfficialPilotLicence[],
  championship: TeamChampionshipLicence,
): TeamChampionshipLicenceAccess {
  const licence = licences.find(
    (candidate) => isCurrentlyValid(candidate) && matchesChampionship(candidate, championship),
  );

  return {
    championship,
    valid: Boolean(licence),
    licenceNumber: licence?.licence_number ?? null,
    licenceName: licence?.licence_name ?? null,
    validUntil: licence?.valid_until ?? null,
  };
}
