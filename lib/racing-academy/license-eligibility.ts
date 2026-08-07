import { createClient } from "@/lib/supabase/server";

export type AcademyLicenseEligibilityV139 = {
  configured: boolean;
  eligible: boolean;
  qualificationCount: number;
  qualifications: Array<{
    id: number;
    number: string;
    label: string;
    issuedAt: string;
  }>;
};

export async function getAcademyLicenseEligibilityV139(
  userId: string,
): Promise<AcademyLicenseEligibilityV139> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("academy_qualifications_v137")
      .select("id,qualification_number,qualification_label,issued_at,active")
      .eq("user_id", userId)
      .eq("active", true)
      .order("issued_at", { ascending: false });

    if (error) {
      return {
        configured: false,
        eligible: false,
        qualificationCount: 0,
        qualifications: [],
      };
    }

    const qualifications = (data ?? []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      number: String(row.qualification_number ?? ""),
      label: String(row.qualification_label ?? "Formation Academy validée"),
      issuedAt: String(row.issued_at ?? ""),
    }));

    return {
      configured: true,
      eligible: qualifications.length > 0,
      qualificationCount: qualifications.length,
      qualifications,
    };
  } catch {
    return {
      configured: false,
      eligible: false,
      qualificationCount: 0,
      qualifications: [],
    };
  }
}
