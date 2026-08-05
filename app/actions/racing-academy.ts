"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_PATH = "/circuit/racing-academy";
const STAFF_PATH = "/dashboard/racing-academy";

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberValue(value: FormDataEntryValue | null): number {
  const parsed = Number(text(value, 50).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAcademyStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => role === "manager" || role === "commissioner")) redirect("/accueil");
  return { supabase, user: data.user };
}

function refresh() {
  revalidatePath(PUBLIC_PATH);
  revalidatePath(STAFF_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/commissaires");
}

export async function saveAcademyCourseV137(formData: FormData) {
  const id = Math.floor(numberValue(formData.get("course_id")));
  const title = text(formData.get("title"), 160);
  const description = text(formData.get("description"), 3000);
  const duration = text(formData.get("duration_label"), 100);
  const qualification = text(formData.get("qualification_label"), 180);
  const maxParticipants = Math.floor(numberValue(formData.get("max_participants")));
  const theory = numberValue(formData.get("theory_pass_score"));
  const practical = numberValue(formData.get("practical_pass_score"));
  const sortOrder = Math.floor(numberValue(formData.get("sort_order")));
  if (!title || description.length < 10 || !duration || !qualification || maxParticipants < 1 || theory < 0 || theory > 100 || practical < 0 || practical > 100) {
    redirect(`${STAFF_PATH}?error=invalid`);
  }

  const { supabase, user } = await requireAcademyStaff();
  const payload = {
    title,
    description,
    duration_label: duration,
    qualification_label: qualification,
    max_participants: maxParticipants,
    theory_pass_score: theory,
    practical_pass_score: practical,
    active: formData.get("active") === "true",
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };
  const result = id > 0
    ? await supabase.from("academy_courses_v137").update(payload).eq("id", id)
    : await supabase.from("academy_courses_v137").insert({ ...payload, created_by: user.id });
  if (result.error) redirect(`${STAFF_PATH}?error=save`);
  refresh();
  redirect(`${STAFF_PATH}?course=1`);
}

export async function enrollAcademyCourseV137(formData: FormData) {
  const courseId = Math.floor(numberValue(formData.get("course_id")));
  const motivation = text(formData.get("motivation"), 1500);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const applicantName = getRpName(data.user) || getDiscordName(data.user) || "Pilote";
  if (!courseId || motivation.length < 5) redirect(`${PUBLIC_PATH}?error=invalid`);

  const { data: course } = await supabase.from("academy_courses_v137").select("id,active").eq("id", courseId).eq("active", true).maybeSingle();
  if (!course) redirect(`${PUBLIC_PATH}?error=closed`);
  const { error } = await supabase.from("academy_enrollments_v137").insert({
    course_id: courseId,
    user_id: data.user.id,
    applicant_name: applicantName,
    motivation,
    status: "pending",
  });
  if (error) {
    const code = error.code === "23505" ? "exists" : "save";
    redirect(`${PUBLIC_PATH}?error=${code}`);
  }
  refresh();
  redirect(`${PUBLIC_PATH}?sent=1`);
}

export async function cancelAcademyEnrollmentV137(formData: FormData) {
  const id = Math.floor(numberValue(formData.get("enrollment_id")));
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const { error } = await supabase.from("academy_enrollments_v137").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", data.user.id).in("status", ["pending", "accepted"]);
  if (error) redirect(`${PUBLIC_PATH}?error=save`);
  refresh();
  redirect(`${PUBLIC_PATH}?cancelled=1`);
}

export async function reviewAcademyEnrollmentV137(formData: FormData) {
  const id = Math.floor(numberValue(formData.get("enrollment_id")));
  const status = text(formData.get("status"), 30);
  const theoryRaw = text(formData.get("theory_score"), 20);
  const practicalRaw = text(formData.get("practical_score"), 20);
  const theory = theoryRaw ? numberValue(formData.get("theory_score")) : null;
  const practical = practicalRaw ? numberValue(formData.get("practical_score")) : null;
  if (!id || !["pending", "accepted", "training", "passed", "failed", "cancelled"].includes(status) || (theory != null && (theory < 0 || theory > 100)) || (practical != null && (practical < 0 || practical > 100))) {
    redirect(`${STAFF_PATH}?error=invalid`);
  }
  const { supabase } = await requireAcademyStaff();

  if (status === "accepted") {
    const { data: enrollment } = await supabase.from("academy_enrollments_v137").select("course_id").eq("id", id).maybeSingle();
    if (enrollment) {
      const [{ count }, { data: course }] = await Promise.all([
        supabase.from("academy_enrollments_v137").select("id", { count: "exact", head: true }).eq("course_id", enrollment.course_id).neq("id", id).in("status", ["accepted", "training"]),
        supabase.from("academy_courses_v137").select("max_participants").eq("id", enrollment.course_id).maybeSingle(),
      ]);
      if (course && (count ?? 0) >= Number(course.max_participants)) redirect(`${STAFF_PATH}?error=full`);
    }
  }

  const { error } = await supabase.from("academy_enrollments_v137").update({
    status,
    theory_score: theory,
    practical_score: practical,
    instructor_name: text(formData.get("instructor_name"), 160) || null,
    staff_note: text(formData.get("staff_note"), 2000) || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) {
    const code = `${error.message}`.includes("passing_scores_required") ? "scores" : "save";
    redirect(`${STAFF_PATH}?error=${code}`);
  }
  refresh();
  redirect(`${STAFF_PATH}?enrollment=1`);
}
