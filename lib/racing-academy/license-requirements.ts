import { createClient } from "@/lib/supabase/server";

export type AcademyLicenseRequirementV140 = {
  licenseCode: string;
  licenseLabel: string;
  requiredCourseId: number | null;
  prerequisiteLicenseCode: string | null;
  minTheoryScore: number;
  minPracticalScore: number;
  licenseValidityMonths: number;
  active: boolean;
  updatedAt: string;
};

export type AcademyLicenseEligibilityV140 = {
  configured: boolean;
  eligible: boolean;
  reason:
    | "ok"
    | "academy_training_required"
    | "academy_specific_training_required"
    | "academy_training_expired"
    | "prerequisite_license_required"
    | "license_suspended"
    | "license_revoked"
    | "academy_requirement_disabled"
    | "setup";
  licenseCode: string;
  licenseLabel: string;
  requiredCourseId: number | null;
  requiredCourseTitle: string | null;
  qualificationId: number | null;
  qualificationLabel: string | null;
  qualificationValidUntil: string | null;
  prerequisiteLicenseCode: string | null;
  prerequisiteLicenseLabel: string | null;
  trainingOk: boolean;
  prerequisiteOk: boolean;
  licenseValidityMonths: number;
};

export type AcademyLicenceControlV140 = {
  licenceId: string;
  holderUserId: string;
  state: "active" | "suspended" | "revoked";
  reason: string | null;
  suspendedUntil: string | null;
  updatedByName: string | null;
  updatedAt: string;
};

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getAcademyLicenseRequirementsV140(): Promise<
  AcademyLicenseRequirementV140[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("academy_license_requirements_v140")
      .select(
        "license_code,license_label,required_course_id,prerequisite_license_code,min_theory_score,min_practical_score,license_validity_months,active,updated_at",
      )
      .order("license_label");

    if (error || !Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      licenseCode: String(row.license_code ?? ""),
      licenseLabel: String(row.license_label ?? row.license_code ?? "Licence"),
      requiredCourseId: numberOrNull(row.required_course_id),
      prerequisiteLicenseCode: stringOrNull(row.prerequisite_license_code),
      minTheoryScore: Number(row.min_theory_score ?? 0),
      minPracticalScore: Number(row.min_practical_score ?? 0),
      licenseValidityMonths: Number(row.license_validity_months ?? 5),
      active: row.active !== false,
      updatedAt: String(row.updated_at ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function getAcademyLicenseEligibilityV140(
  userId: string,
  licenseCode: string,
): Promise<AcademyLicenseEligibilityV140> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "nostra_v140_license_eligibility",
      {
        p_user: userId,
        p_license_code: licenseCode,
      },
    );

    if (error) {
      return {
        configured: false,
        eligible: false,
        reason: "setup",
        licenseCode,
        licenseLabel: licenseCode,
        requiredCourseId: null,
        requiredCourseTitle: null,
        qualificationId: null,
        qualificationLabel: null,
        qualificationValidUntil: null,
        prerequisiteLicenseCode: null,
        prerequisiteLicenseLabel: null,
        trainingOk: false,
        prerequisiteOk: false,
        licenseValidityMonths: 5,
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      return {
        configured: false,
        eligible: false,
        reason: "setup",
        licenseCode,
        licenseLabel: licenseCode,
        requiredCourseId: null,
        requiredCourseTitle: null,
        qualificationId: null,
        qualificationLabel: null,
        qualificationValidUntil: null,
        prerequisiteLicenseCode: null,
        prerequisiteLicenseLabel: null,
        trainingOk: false,
        prerequisiteOk: false,
        licenseValidityMonths: 5,
      };
    }

    const value = row as Record<string, unknown>;
    const reason = String(value.reason ?? "setup") as AcademyLicenseEligibilityV140["reason"];

    return {
      configured: true,
      eligible: value.eligible === true,
      reason,
      licenseCode: String(value.license_code ?? licenseCode),
      licenseLabel: String(value.license_label ?? licenseCode),
      requiredCourseId: numberOrNull(value.required_course_id),
      requiredCourseTitle: stringOrNull(value.required_course_title),
      qualificationId: numberOrNull(value.qualification_id),
      qualificationLabel: stringOrNull(value.qualification_label),
      qualificationValidUntil: stringOrNull(value.qualification_valid_until),
      prerequisiteLicenseCode: stringOrNull(value.prerequisite_license_code),
      prerequisiteLicenseLabel: stringOrNull(value.prerequisite_license_label),
      trainingOk: value.training_ok === true,
      prerequisiteOk: value.prerequisite_ok !== false,
      licenseValidityMonths: Number(value.license_validity_months ?? 5),
    };
  } catch {
    return {
      configured: false,
      eligible: false,
      reason: "setup",
      licenseCode,
      licenseLabel: licenseCode,
      requiredCourseId: null,
      requiredCourseTitle: null,
      qualificationId: null,
      qualificationLabel: null,
      qualificationValidUntil: null,
      prerequisiteLicenseCode: null,
      prerequisiteLicenseLabel: null,
      trainingOk: false,
      prerequisiteOk: false,
      licenseValidityMonths: 5,
    };
  }
}

export async function getAcademyLicenseEligibilitiesV140(
  userId: string,
  licenseCodes: string[],
): Promise<Map<string, AcademyLicenseEligibilityV140>> {
  const entries = await Promise.all(
    licenseCodes.map(async (code) => [code, await getAcademyLicenseEligibilityV140(userId, code)] as const),
  );
  return new Map(entries);
}

export async function getAcademyLicenceControlsV140(
  userId?: string,
): Promise<AcademyLicenceControlV140[]> {
  try {
    const supabase = await createClient();
    let query = (supabase as any)
      .from("academy_licence_controls_v140")
      .select(
        "licence_id,holder_user_id,control_state,reason,suspended_until,updated_by_name,updated_at",
      )
      .order("updated_at", { ascending: false });

    if (userId) query = query.eq("holder_user_id", userId);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      licenceId: String(row.licence_id ?? ""),
      holderUserId: String(row.holder_user_id ?? ""),
      state:
        row.control_state === "revoked"
          ? "revoked"
          : row.control_state === "suspended"
            ? "suspended"
            : "active",
      reason: stringOrNull(row.reason),
      suspendedUntil: stringOrNull(row.suspended_until),
      updatedByName: stringOrNull(row.updated_by_name),
      updatedAt: String(row.updated_at ?? ""),
    }));
  } catch {
    return [];
  }
}
