import { createClient } from "@/lib/supabase/server";

export const LICENCE_EXPIRY_WARNING_DAYS = 30;
export const LICENCE_RENEWAL_OPEN_DAYS = 60;

export type LicenceLifecycleStatus =
  | "upcoming"
  | "active"
  | "expiring_soon"
  | "expired";

export type LicenceLifecycle = {
  status: LicenceLifecycleStatus;
  label: string;
  daysRemaining: number | null;
  canRenew: boolean;
};

export type OfficialPilotLicence = {
  id: string;
  holder_name: string;
  licence_number: string;
  licence_name: string;
  category: string | null;
  authority: string;
  valid_from: string;
  valid_until: string | null;
  stored_status: string;
  created_at: string;
  renewalLicenseCode: string | null;
  lifecycle: LicenceLifecycle;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12),
  );
}

export function getLicenceLifecycle(
  validFrom: string,
  validUntil: string | null,
): LicenceLifecycle {
  const today = todayUtc();
  const startsAt = dateOnly(validFrom);
  const expiresAt = validUntil ? dateOnly(validUntil) : null;

  if (startsAt && startsAt.getTime() > today.getTime()) {
    return {
      status: "upcoming",
      label: "Renouvellement programmé",
      daysRemaining: null,
      canRenew: false,
    };
  }

  if (!expiresAt) {
    return {
      status: "active",
      label: "Valide",
      daysRemaining: null,
      canRenew: false,
    };
  }

  const daysRemaining = Math.floor(
    (expiresAt.getTime() - today.getTime()) / DAY_MS,
  );

  if (daysRemaining < 0) {
    return {
      status: "expired",
      label: "Expirée",
      daysRemaining,
      canRenew: true,
    };
  }

  if (daysRemaining <= LICENCE_EXPIRY_WARNING_DAYS) {
    return {
      status: "expiring_soon",
      label: "Bientôt expirée",
      daysRemaining,
      canRenew: true,
    };
  }

  return {
    status: "active",
    label: "Valide",
    daysRemaining,
    canRenew: daysRemaining <= LICENCE_RENEWAL_OPEN_DAYS,
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchLicenceCode(
  licenceName: string,
  types: Array<{ code: string; label: string }>,
): string | null {
  const wanted = normalize(licenceName);

  const exact = types.find((type) => normalize(type.label) === wanted);
  if (exact) return exact.code;

  const byCode = types.find((type) =>
    wanted.includes(normalize(type.code)),
  );
  if (byCode) return byCode.code;

  if (wanted.includes("gt3")) {
    return types.find((type) => normalize(type.code).includes("gt3"))?.code ?? null;
  }

  if (wanted.includes("f1")) {
    return types.find((type) => normalize(type.code) === "f1")?.code ?? null;
  }

  if (wanted.includes("circuit") || wanted.includes("pilote")) {
    return (
      types.find(
        (type) =>
          normalize(type.code).includes("circuit") ||
          normalize(type.label).includes("circuit") ||
          normalize(type.label).includes("pilote"),
      )?.code ?? null
    );
  }

  return null;
}

export async function getOwnOfficialPilotLicences(
  userId: string,
): Promise<OfficialPilotLicence[]> {
  try {
    const supabase = await createClient();

    await (supabase as any).rpc("refresh_my_license_expiry_notifications");

    const [licencesResult, typesResult] = await Promise.all([
      (supabase as any)
        .from("nostra_licences")
        .select(
          "id,holder_name,licence_number,licence_name,category,authority,valid_from,valid_until,status,created_at",
        )
        .eq("holder_user_id", userId)
        .order("valid_until", { ascending: false, nullsFirst: false }),
      (supabase as any)
        .from("pilot_license_types")
        .select("code,label")
        .order("sort_order", { ascending: true }),
    ]);

    if (licencesResult.error || !Array.isArray(licencesResult.data)) {
      return [];
    }

    const types = Array.isArray(typesResult.data)
      ? typesResult.data.map((row: Record<string, unknown>) => ({
          code: String(row.code ?? ""),
          label: String(row.label ?? ""),
        }))
      : [];

    return licencesResult.data.map((row: Record<string, unknown>) => {
      const validFrom = String(row.valid_from ?? "");
      const validUntil =
        typeof row.valid_until === "string" ? row.valid_until : null;
      const licenceName = String(row.licence_name ?? "Licence pilote");

      return {
        id: String(row.id ?? ""),
        holder_name: String(row.holder_name ?? ""),
        licence_number: String(row.licence_number ?? ""),
        licence_name: licenceName,
        category:
          typeof row.category === "string" && row.category.trim()
            ? row.category
            : null,
        authority: String(row.authority ?? "Nostra Circuit"),
        valid_from: validFrom,
        valid_until: validUntil,
        stored_status: String(row.status ?? "Valide"),
        created_at: String(row.created_at ?? ""),
        renewalLicenseCode: matchLicenceCode(licenceName, types),
        lifecycle: getLicenceLifecycle(validFrom, validUntil),
      } satisfies OfficialPilotLicence;
    });
  } catch {
    return [];
  }
}
