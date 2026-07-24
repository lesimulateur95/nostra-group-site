import {
  normalizeCircuitLicenceCategory,
  normalizeCircuitLicenceName,
} from "@/lib/licenses/naming";
import { createClient } from "@/lib/supabase/server";

export const LICENCE_EXPIRY_WARNING_DAYS = 30;
export const LICENCE_RENEWAL_OPEN_DAYS = 60;

export type LicenceLifecycleStatus =
  | "upcoming"
  | "active"
  | "expiring_soon"
  | "expired"
  | "suspended";

export type LicenceLifecycle = {
  status: LicenceLifecycleStatus;
  label: string;
  daysRemaining: number | null;
  canRenew: boolean;
};

export type LicenceDisciplineState = {
  pointsRemaining: number;
  pointsRemoved: number;
  isSuspended: boolean;
  suspensionEndsOn: string | null;
  suspensionReason: string | null;
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
  discipline: LicenceDisciplineState;
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

  const byCode = types.find((type) => wanted.includes(normalize(type.code)));
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

type DisciplineRow = {
  licence_id?: unknown;
  action_type?: unknown;
  points_removed?: unknown;
  suspension_starts_on?: unknown;
  suspension_ends_on?: unknown;
  reason?: unknown;
  status?: unknown;
};

function disciplineForLicence(
  licenceId: string,
  rows: DisciplineRow[],
): LicenceDisciplineState {
  const related = rows.filter(
    (row) => String(row.licence_id ?? "") === licenceId,
  );

  const pointsRemoved = related
    .filter(
      (row) =>
        String(row.action_type ?? "") === "points_deduction" &&
        String(row.status ?? "") !== "cancelled",
    )
    .reduce((total, row) => total + Number(row.points_removed ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const suspension = related.find((row) => {
    const start =
      typeof row.suspension_starts_on === "string"
        ? row.suspension_starts_on
        : "";
    const end =
      typeof row.suspension_ends_on === "string"
        ? row.suspension_ends_on
        : "";

    return (
      String(row.action_type ?? "") === "suspension" &&
      String(row.status ?? "") !== "cancelled" &&
      Boolean(start && end) &&
      today >= start &&
      today <= end
    );
  });

  return {
    pointsRemaining: Math.max(0, 12 - pointsRemoved),
    pointsRemoved,
    isSuspended: Boolean(suspension),
    suspensionEndsOn:
      suspension && typeof suspension.suspension_ends_on === "string"
        ? suspension.suspension_ends_on
        : null,
    suspensionReason:
      suspension && typeof suspension.reason === "string"
        ? suspension.reason
        : null,
  };
}

export async function getOwnOfficialPilotLicences(
  userId: string,
): Promise<OfficialPilotLicence[]> {
  try {
    const supabase = await createClient();

    // Ces opérations sont indépendantes. Les lancer ensemble évite trois
    // allers-retours Supabase successifs avant même de charger la page.
    await Promise.allSettled([
      (supabase as any).rpc("nostra_sync_my_signed_pilot_licences_v75"),
      (supabase as any).rpc("refresh_my_license_expiry_notifications"),
      (supabase as any).rpc(
        "nostra_refresh_expired_disciplinary_suspensions",
      ),
    ]);

    const [licencesResult, typesResult, disciplineResult] = await Promise.all([
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
      (supabase as any)
        .from("nostra_circuit_disciplinary_actions")
        .select(
          "licence_id,action_type,points_removed,suspension_starts_on,suspension_ends_on,reason,status",
        )
        .eq("holder_user_id", userId),
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

    const disciplineRows = Array.isArray(disciplineResult.data)
      ? (disciplineResult.data as DisciplineRow[])
      : [];

    return licencesResult.data.map((row: Record<string, unknown>) => {
      const id = String(row.id ?? "");
      const validFrom = String(row.valid_from ?? "");
      const validUntil =
        typeof row.valid_until === "string" ? row.valid_until : null;
      const licenceName = normalizeCircuitLicenceName(
        String(row.licence_name ?? "Licence Circuit"),
      );
      const discipline = disciplineForLicence(id, disciplineRows);
      const baseLifecycle = getLicenceLifecycle(validFrom, validUntil);
      const lifecycle: LicenceLifecycle = discipline.isSuspended
        ? {
            ...baseLifecycle,
            status: "suspended",
            label: "Suspendue",
            canRenew: false,
          }
        : baseLifecycle;

      return {
        id,
        holder_name: String(row.holder_name ?? ""),
        licence_number: String(row.licence_number ?? ""),
        licence_name: licenceName,
        category: normalizeCircuitLicenceCategory(
          licenceName,
          typeof row.category === "string" ? row.category : null,
        ),
        authority: String(row.authority ?? "Nostra Circuit"),
        valid_from: validFrom,
        valid_until: validUntil,
        stored_status: String(row.status ?? "Valide"),
        created_at: String(row.created_at ?? ""),
        renewalLicenseCode: matchLicenceCode(licenceName, types),
        lifecycle,
        discipline,
      } satisfies OfficialPilotLicence;
    });
  } catch {
    return [];
  }
}
