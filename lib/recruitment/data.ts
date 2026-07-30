import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RecruitmentApplicationStatus =
  | "new"
  | "reviewing"
  | "interview"
  | "accepted"
  | "refused"
  | "archived";

export type RecruitmentApplication = {
  id: number;
  application_number: string;
  user_id: string;
  candidate_name: string;
  discord_name: string | null;
  phone: string | null;
  position: string;
  availability: string;
  motivation: string;
  experience: string | null;
  strengths: string | null;
  status: RecruitmentApplicationStatus;
  assigned_to: string | null;
  interview_at: string | null;
  internal_notes: string | null;
  manager_response: string | null;
  created_at: string;
  updated_at: string;
};

export type RecruitmentHistoryEntry = {
  id: number;
  application_id: number;
  actor_user_id: string | null;
  from_status: RecruitmentApplicationStatus | null;
  to_status: RecruitmentApplicationStatus;
  note: string | null;
  created_at: string;
};

const applicationColumns = [
  "id",
  "application_number",
  "user_id",
  "candidate_name",
  "discord_name",
  "phone",
  "position",
  "availability",
  "motivation",
  "experience",
  "strengths",
  "status",
  "assigned_to",
  "interview_at",
  "manager_response",
  "created_at",
  "updated_at",
].join(",");

function normalizeApplication(
  row: Record<string, unknown>,
  internalNotes: string | null = null,
): RecruitmentApplication {
  return {
    ...row,
    id: Number(row.id),
    internal_notes: internalNotes,
  } as RecruitmentApplication;
}

/**
 * La disponibilité du module est vérifiée avec le client serveur secret.
 * Cela évite qu'une connexion Steam valide soit considérée comme non configurée
 * à cause d'une ancienne politique RLS prévue pour Discord.
 */
export async function getRecruitmentConfigured(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const [applicationsResult, privateResult] = await Promise.all([
      admin.from("recruitment_applications").select(applicationColumns).limit(1),
      admin
        .from("recruitment_application_private_v96")
        .select("application_id,internal_notes")
        .limit(1),
    ]);

    if (applicationsResult.error || privateResult.error) {
      console.error("Recruitment configuration check failed", {
        applications: applicationsResult.error,
        privateNotes: privateResult.error,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Recruitment configuration check failed", error);
    return false;
  }
}

/**
 * Données réservées à la Direction : la page qui appelle cette fonction est
 * déjà protégée par DashboardShell. Le client admin évite les faux refus RLS
 * après une connexion Steam.
 */
export async function getRecruitmentApplications(): Promise<RecruitmentApplication[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("recruitment_applications")
      .select(applicationColumns)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Recruitment applications load failed", error);
      return [];
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const ids = rows.map((row) => Number(row.id)).filter((id) => id > 0);
    if (ids.length === 0) return [];

    const { data: privateRows, error: privateError } = await admin
      .from("recruitment_application_private_v96")
      .select("application_id,internal_notes")
      .in("application_id", ids);

    if (privateError) {
      console.error("Recruitment private notes load failed", privateError);
    }

    const privateNotes = new Map<number, string | null>();
    for (const privateRow of (privateRows ?? []) as unknown as Record<
      string,
      unknown
    >[]) {
      privateNotes.set(
        Number(privateRow.application_id),
        typeof privateRow.internal_notes === "string"
          ? privateRow.internal_notes
          : null,
      );
    }

    return rows.map((row) =>
      normalizeApplication(row, privateNotes.get(Number(row.id)) ?? null),
    );
  } catch (error) {
    console.error("Recruitment applications load failed", error);
    return [];
  }
}

export async function getOwnRecruitmentApplications(
  userId: string,
): Promise<RecruitmentApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruitment_applications")
    .select(applicationColumns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    normalizeApplication(row),
  );
}

export async function getRecruitmentHistory(
  applicationIds: number[],
): Promise<RecruitmentHistoryEntry[]> {
  if (applicationIds.length === 0) return [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("recruitment_application_history")
      .select("id,application_id,actor_user_id,from_status,to_status,note,created_at")
      .in("application_id", applicationIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Recruitment history load failed", error);
      return [];
    }

    return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
      ...row,
      id: Number(row.id),
      application_id: Number(row.application_id),
    })) as RecruitmentHistoryEntry[];
  } catch (error) {
    console.error("Recruitment history load failed", error);
    return [];
  }
}

export async function getRecruitmentSummary() {
  const [configured, applications] = await Promise.all([
    getRecruitmentConfigured(),
    getRecruitmentApplications(),
  ]);

  return {
    configured,
    total: applications.length,
    pending: applications.filter((item) =>
      ["new", "reviewing", "interview"].includes(item.status),
    ).length,
    interviews: applications.filter((item) => item.status === "interview")
      .length,
  };
}
