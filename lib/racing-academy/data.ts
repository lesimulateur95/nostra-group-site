import { createClient } from "@/lib/supabase/server";

export type AcademyCourseV137 = {
  id: number;
  title: string;
  description: string;
  durationLabel: string;
  maxParticipants: number;
  theoryPassScore: number;
  practicalPassScore: number;
  qualificationLabel: string;
  active: boolean;
  sortOrder: number;
};

export type AcademyEnrollmentV137 = {
  id: number;
  courseId: number;
  userId: string;
  applicantName: string;
  motivation: string | null;
  status: string;
  theoryScore: number | null;
  practicalScore: number | null;
  instructorName: string | null;
  staffNote: string | null;
  appliedAt: string;
  completedAt: string | null;
};

export type AcademyQualificationV137 = {
  id: number;
  number: string;
  userId: string;
  holderName: string;
  label: string;
  theoryScore: number;
  practicalScore: number;
  issuedAt: string;
  active: boolean;
};

const courseColumns = "id,title,description,duration_label,max_participants,theory_pass_score,practical_pass_score,qualification_label,active,sort_order";
const enrollmentColumns = "id,course_id,user_id,applicant_name,motivation,status,theory_score,practical_score,instructor_name,staff_note,applied_at,completed_at";

function mapCourse(row: Record<string, unknown>): AcademyCourseV137 {
  return {
    id: Number(row.id),
    title: String(row.title),
    description: String(row.description),
    durationLabel: String(row.duration_label),
    maxParticipants: Number(row.max_participants),
    theoryPassScore: Number(row.theory_pass_score),
    practicalPassScore: Number(row.practical_pass_score),
    qualificationLabel: String(row.qualification_label),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
  };
}

function mapEnrollment(row: Record<string, unknown>): AcademyEnrollmentV137 {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    userId: String(row.user_id),
    applicantName: String(row.applicant_name),
    motivation: typeof row.motivation === "string" ? row.motivation : null,
    status: String(row.status),
    theoryScore: row.theory_score == null ? null : Number(row.theory_score),
    practicalScore: row.practical_score == null ? null : Number(row.practical_score),
    instructorName: typeof row.instructor_name === "string" ? row.instructor_name : null,
    staffNote: typeof row.staff_note === "string" ? row.staff_note : null,
    appliedAt: String(row.applied_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export async function getAcademyConfiguredV137(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("academy_courses_v137").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function getAcademyCoursesV137(includeInactive = false): Promise<AcademyCourseV137[]> {
  const supabase = await createClient();
  let query = supabase.from("academy_courses_v137").select(courseColumns).order("sort_order").order("title");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as Array<Record<string, unknown>>).map(mapCourse);
}

export async function getAcademyEnrollmentsV137(userId?: string): Promise<AcademyEnrollmentV137[]> {
  const supabase = await createClient();
  let query = supabase.from("academy_enrollments_v137").select(enrollmentColumns).order("applied_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as Array<Record<string, unknown>>).map(mapEnrollment);
}

export async function getAcademyQualificationsV137(userId?: string): Promise<AcademyQualificationV137[]> {
  const supabase = await createClient();
  let query = supabase.from("academy_qualifications_v137").select("id,qualification_number,user_id,holder_name,qualification_label,theory_score,practical_score,issued_at,active").order("issued_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  return error ? [] : (data ?? []).map((row) => ({
    id: Number(row.id),
    number: String(row.qualification_number),
    userId: String(row.user_id),
    holderName: String(row.holder_name),
    label: String(row.qualification_label),
    theoryScore: Number(row.theory_score),
    practicalScore: Number(row.practical_score),
    issuedAt: String(row.issued_at),
    active: Boolean(row.active),
  }));
}

export async function getAcademyPendingCountV137(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase.from("academy_enrollments_v137").select("id", { count: "exact", head: true }).eq("status", "pending");
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}
