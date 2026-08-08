"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_PATH = "/circuit/racing-academy";
const STAFF_PATH = "/dashboard/racing-academy";
const QUIZ_STAFF_PATH = "/dashboard/racing-academy/questionnaires";
const EVAL_STAFF_PATH = "/dashboard/racing-academy/evaluations";

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
  revalidatePath("/profil/licences");
  revalidatePath("/dashboard/citoyens");
  revalidatePath(QUIZ_STAFF_PATH);
  revalidatePath(EVAL_STAFF_PATH);
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
  const qualificationValidDaysRaw = text(formData.get("qualification_valid_days"), 20);
  const qualificationValidDays = qualificationValidDaysRaw
    ? Math.floor(numberValue(formData.get("qualification_valid_days")))
    : 0;
  if (!title || description.length < 10 || !duration || !qualification || maxParticipants < 1 || theory < 0 || theory > 100 || practical < 0 || practical > 100 || qualificationValidDays < 0 || qualificationValidDays > 3650) {
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
    qualification_valid_days: qualificationValidDays > 0 ? qualificationValidDays : null,
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
    const message = `${error.message}`;
    const code = message.includes("passing_scores_required")
      ? "scores"
      : message.includes("academy_quiz_required")
        ? "quiz-required"
        : "save";
    redirect(`${STAFF_PATH}?error=${code}`);
  }
  refresh();
  redirect(`${STAFF_PATH}?enrollment=1`);
}


export async function saveAcademyLicenseRequirementV140(formData: FormData) {
  const licenseCode = text(formData.get("license_code"), 60);
  const licenseLabel = text(formData.get("license_label"), 180) || licenseCode;
  const requiredCourseRaw = text(formData.get("required_course_id"), 30);
  const requiredCourseId = requiredCourseRaw
    ? Math.floor(numberValue(formData.get("required_course_id")))
    : null;
  const prerequisiteLicenseCode = text(formData.get("prerequisite_license_code"), 60) || null;
  const minTheoryScore = numberValue(formData.get("min_theory_score"));
  const minPracticalScore = numberValue(formData.get("min_practical_score"));
  const licenseValidityMonths = Math.floor(numberValue(formData.get("license_validity_months")));
  const active = formData.get("active") !== "false";

  if (
    !licenseCode ||
    (requiredCourseId !== null && requiredCourseId <= 0) ||
    prerequisiteLicenseCode === licenseCode ||
    minTheoryScore < 0 ||
    minTheoryScore > 100 ||
    minPracticalScore < 0 ||
    minPracticalScore > 100 ||
    licenseValidityMonths < 1 ||
    licenseValidityMonths > 60
  ) {
    redirect(`${STAFF_PATH}?error=requirement-invalid`);
  }

  const { supabase, user } = await requireAcademyStaff();
  const { error } = await (supabase as any)
    .from("academy_license_requirements_v140")
    .upsert(
      {
        license_code: licenseCode,
        license_label: licenseLabel,
        required_course_id: requiredCourseId,
        prerequisite_license_code: prerequisiteLicenseCode,
        min_theory_score: minTheoryScore,
        min_practical_score: minPracticalScore,
        license_validity_months: licenseValidityMonths,
        active,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "license_code" },
    );

  if (error) redirect(`${STAFF_PATH}?error=requirement-save`);
  refresh();
  revalidatePath("/circuit/administration-sportive/payer-ma-licence");
  redirect(`${STAFF_PATH}?requirement=1`);
}



export async function syncAcademyQuizzesV1471() {
  const { supabase } = await requireAcademyStaff();
  const { data, error } = await (supabase as any).rpc("academy_sync_quizzes_v147_1");
  if (error) redirect(`${QUIZ_STAFF_PATH}?error=quiz-sync`);
  refresh();
  redirect(`${QUIZ_STAFF_PATH}?synced=${Number(data ?? 0)}`);
}

export async function createAcademyQuizV1471(formData: FormData) {
  const courseId = Math.floor(numberValue(formData.get("course_id")));
  const title = text(formData.get("title"), 180);
  if (!courseId || !title) redirect(`${QUIZ_STAFF_PATH}?error=quiz-invalid`);
  const { supabase } = await requireAcademyStaff();
  const { data, error } = await (supabase as any).rpc("academy_create_quiz_v147_1", {
    p_course_id: courseId,
    p_title: title,
  });
  if (error || !data) {
    const message = `${error?.message ?? ""}`;
    const code = message.includes("quiz_already_exists") ? "quiz-exists" : "quiz-create";
    redirect(`${QUIZ_STAFF_PATH}?error=${code}`);
  }
  refresh();
  redirect(`${QUIZ_STAFF_PATH}?created=1&quiz=${Number(data)}&course=${courseId}`);
}

export async function deleteAcademyQuizV1471(formData: FormData) {
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  if (!quizId) redirect(`${QUIZ_STAFF_PATH}?error=quiz-invalid`);
  const { supabase } = await requireAcademyStaff();
  const { error } = await (supabase as any).rpc("academy_delete_quiz_v147_1", { p_quiz_id: quizId });
  if (error) redirect(`${QUIZ_STAFF_PATH}?error=quiz-delete`);
  refresh();
  redirect(`${QUIZ_STAFF_PATH}?deleted=1`);
}

export async function deleteAcademyQuizQuestionV1471(formData: FormData) {
  const questionId = Math.floor(numberValue(formData.get("question_id")));
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  if (!questionId || !quizId) redirect(`${QUIZ_STAFF_PATH}?error=question-invalid`);
  const { supabase } = await requireAcademyStaff();
  const { error } = await (supabase as any)
    .from("academy_quiz_questions_v143")
    .delete()
    .eq("id", questionId)
    .eq("quiz_id", quizId);
  if (error) {
    const code = `${error.message ?? ""}`.includes("foreign key") ? "question-used" : "question-delete";
    redirect(`${QUIZ_STAFF_PATH}?error=${code}&quiz=${quizId}`);
  }
  refresh();
  redirect(`${QUIZ_STAFF_PATH}?question_deleted=1&quiz=${quizId}`);
}

export async function saveAcademyQuizSettingsV143(formData: FormData) {
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  const courseId = Math.floor(numberValue(formData.get("course_id")));
  const title = text(formData.get("title"), 180);
  const instructions = text(formData.get("instructions"), 3000) || null;
  const passScore = numberValue(formData.get("pass_score"));
  const maxAttempts = Math.floor(numberValue(formData.get("max_attempts")));
  const timeLimitMinutes = Math.floor(numberValue(formData.get("time_limit_minutes")));
  const questionCount = Math.floor(numberValue(formData.get("question_count")));
  const randomizeQuestions = formData.get("randomize_questions") === "true";
  const showCorrection = formData.get("show_correction") === "true";
  const active = formData.get("active") === "true";

  if (!courseId || !title || passScore < 0 || passScore > 100 || maxAttempts < 1 || maxAttempts > 20 || timeLimitMinutes < 0 || timeLimitMinutes > 180 || questionCount < 0 || questionCount > 200) {
    redirect(`${QUIZ_STAFF_PATH}?error=quiz-invalid`);
  }

  const { supabase, user } = await requireAcademyStaff();
  const payload = {
    course_id: courseId,
    title,
    instructions,
    pass_score: passScore,
    max_attempts: maxAttempts,
    time_limit_minutes: timeLimitMinutes,
    question_count: questionCount,
    randomize_questions: randomizeQuestions,
    show_correction: showCorrection,
    active,
    updated_at: new Date().toISOString(),
  };

  const result = quizId > 0
    ? await (supabase as any).from("academy_quizzes_v143").update(payload).eq("id", quizId)
    : await (supabase as any).from("academy_quizzes_v143").insert({ ...payload, created_by: user.id });

  if (result.error) redirect(`${QUIZ_STAFF_PATH}?error=quiz-save`);
  refresh();
  redirect(`${QUIZ_STAFF_PATH}?quiz=1&course=${courseId}`);
}

export async function saveAcademyQuizQuestionV143(formData: FormData) {
  const questionId = Math.floor(numberValue(formData.get("question_id")));
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  const prompt = text(formData.get("prompt"), 1200);
  const optionA = text(formData.get("option_a"), 500);
  const optionB = text(formData.get("option_b"), 500);
  const optionC = text(formData.get("option_c"), 500) || null;
  const optionD = text(formData.get("option_d"), 500) || null;
  const correctOption = text(formData.get("correct_option"), 1).toUpperCase();
  const explanation = text(formData.get("explanation"), 1800) || null;
  const points = Math.floor(numberValue(formData.get("points"))) || 1;
  const sortOrder = Math.floor(numberValue(formData.get("sort_order")));
  const active = formData.get("active") !== "false";

  const answerExists = correctOption === "A" ? optionA : correctOption === "B" ? optionB : correctOption === "C" ? optionC : correctOption === "D" ? optionD : null;
  if (!quizId || prompt.length < 3 || !optionA || !optionB || !["A", "B", "C", "D"].includes(correctOption) || !answerExists || points < 1 || points > 100) {
    redirect(`${QUIZ_STAFF_PATH}?error=question-invalid&quiz=${quizId}`);
  }

  const { supabase } = await requireAcademyStaff();
  const payload = {
    quiz_id: quizId,
    prompt,
    option_a: optionA,
    option_b: optionB,
    option_c: optionC,
    option_d: optionD,
    correct_option: correctOption,
    explanation,
    points,
    sort_order: sortOrder,
    active,
    updated_at: new Date().toISOString(),
  };

  const result = questionId > 0
    ? await (supabase as any).from("academy_quiz_questions_v143").update(payload).eq("id", questionId)
    : await (supabase as any).from("academy_quiz_questions_v143").insert(payload);

  if (result.error) redirect(`${QUIZ_STAFF_PATH}?error=question-save&quiz=${quizId}`);
  refresh();
  redirect(`${QUIZ_STAFF_PATH}?question=1&quiz=${quizId}`);
}

export async function toggleAcademyQuizQuestionV143(formData: FormData) {
  const questionId = Math.floor(numberValue(formData.get("question_id")));
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  const active = formData.get("active") === "true";
  if (!questionId || !quizId) redirect(`${QUIZ_STAFF_PATH}?error=question-invalid`);
  const { supabase } = await requireAcademyStaff();
  const { error } = await (supabase as any).from("academy_quiz_questions_v143").update({ active, updated_at: new Date().toISOString() }).eq("id", questionId);
  if (error) redirect(`${QUIZ_STAFF_PATH}?error=question-save&quiz=${quizId}`);
  refresh();
  redirect(`${QUIZ_STAFF_PATH}?question=1&quiz=${quizId}`);
}

export async function resetAcademyQuizAttemptsV143(formData: FormData) {
  const enrollmentId = Math.floor(numberValue(formData.get("enrollment_id")));
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  const returnPath = text(formData.get("return_to"), 30) === "evaluations" ? EVAL_STAFF_PATH : QUIZ_STAFF_PATH;
  if (!enrollmentId || !quizId) redirect(`${returnPath}?error=reset-invalid`);
  const { supabase } = await requireAcademyStaff();

  const { error } = await (supabase as any)
    .from("academy_quiz_attempts_v143")
    .delete()
    .eq("enrollment_id", enrollmentId)
    .eq("quiz_id", quizId);
  if (error) redirect(`${returnPath}?error=reset-save`);

  await supabase.from("academy_enrollments_v137").update({
    theory_quiz_passed_at: null,
    theory_quiz_attempt_id: null,
    theory_score: null,
    updated_at: new Date().toISOString(),
  } as any).eq("id", enrollmentId);

  await (supabase as any)
    .from("academy_quiz_assignments_v147")
    .update({ status: "sent", last_attempt_id: null, completed_at: null, updated_at: new Date().toISOString() })
    .eq("enrollment_id", enrollmentId)
    .eq("quiz_id", quizId);

  refresh();
  redirect(`${returnPath}?reset=1&quiz=${quizId}`);
}

export async function startAcademyQuizV143(formData: FormData) {
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  if (!quizId) redirect(`${PUBLIC_PATH}?error=quiz-invalid`);

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data, error } = await (supabase as any).rpc("academy_start_quiz_v143", { p_quiz_id: quizId });
  if (error || !data) {
    const message = `${error?.message ?? ""}`;
    const code = message.includes("max_attempts_reached")
      ? "quiz-max"
      : message.includes("quiz_already_passed")
        ? "quiz-passed"
        : message.includes("training_not_open")
          ? "quiz-not-open"
          : message.includes("quiz_has_no_questions")
            ? "quiz-empty"
            : "quiz-start";
    redirect(`${PUBLIC_PATH}?error=${code}`);
  }
  redirect(`${PUBLIC_PATH}/questionnaire/${Number(data)}`);
}

export async function submitAcademyQuizV143(formData: FormData) {
  const attemptId = Math.floor(numberValue(formData.get("attempt_id")));
  if (!attemptId) redirect(`${PUBLIC_PATH}?error=quiz-submit`);

  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer_")) continue;
    const questionId = key.slice("answer_".length);
    const answer = typeof value === "string" ? value.toUpperCase() : "";
    if (/^\d+$/.test(questionId) && ["A", "B", "C", "D"].includes(answer)) answers[questionId] = answer;
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");
  const { error } = await (supabase as any).rpc("academy_submit_quiz_v143", {
    p_attempt_id: attemptId,
    p_answers: answers,
  });
  if (error) redirect(`${PUBLIC_PATH}/questionnaire/${attemptId}?error=submit`);

  refresh();
  revalidatePath(`${PUBLIC_PATH}/questionnaire/${attemptId}`);
  redirect(`${PUBLIC_PATH}/questionnaire/${attemptId}?result=1`);
}

export async function sendAcademyQuizInvitationV147(formData: FormData) {
  const enrollmentId = Math.floor(numberValue(formData.get("enrollment_id")));
  if (!enrollmentId) redirect(`${EVAL_STAFF_PATH}?error=invite-invalid`);

  const { supabase } = await requireAcademyStaff();
  const { error } = await (supabase as any).rpc("academy_send_quiz_invitation_v147", {
    p_enrollment_id: enrollmentId,
  });

  if (error) {
    const message = `${error.message ?? ""}`;
    const code = message.includes("quiz_not_active")
      ? "quiz-inactive"
      : message.includes("quiz_has_no_questions")
        ? "quiz-empty"
        : message.includes("participant_not_ready")
          ? "participant-not-ready"
          : message.includes("quiz_already_passed")
            ? "quiz-passed"
            : message.includes("mail_not_configured") || message.includes("mailbox_unavailable")
              ? "mail"
              : "invite";
    redirect(`${EVAL_STAFF_PATH}?error=${code}`);
  }

  refresh();
  revalidatePath("/profil/messagerie");
  redirect(`${EVAL_STAFF_PATH}?sent=1&enrollment=${enrollmentId}`);
}

export async function sendAcademyQuizToCourseV147(formData: FormData) {
  const courseId = Math.floor(numberValue(formData.get("course_id")));
  if (!courseId) redirect(`${EVAL_STAFF_PATH}?error=invite-invalid`);

  const { supabase } = await requireAcademyStaff();
  const { data: rows, error: enrollmentError } = await supabase
    .from("academy_enrollments_v137")
    .select("id")
    .eq("course_id", courseId)
    .in("status", ["accepted", "training", "failed"]);

  if (enrollmentError) redirect(`${EVAL_STAFF_PATH}?error=invite`);

  let sent = 0;
  for (const row of rows ?? []) {
    const { error } = await (supabase as any).rpc("academy_send_quiz_invitation_v147", {
      p_enrollment_id: Number(row.id),
    });
    if (!error) sent += 1;
  }

  refresh();
  revalidatePath("/profil/messagerie");
  redirect(`${EVAL_STAFF_PATH}?sent_all=${sent}&course=${courseId}`);
}

export async function saveAcademyParticipantEvaluationV147(formData: FormData) {
  const enrollmentId = Math.floor(numberValue(formData.get("enrollment_id")));
  const status = text(formData.get("status"), 30);
  const practicalRaw = text(formData.get("practical_score"), 20);
  const practicalScore = practicalRaw ? numberValue(formData.get("practical_score")) : null;
  const instructorName = text(formData.get("instructor_name"), 160) || null;
  const appreciation = text(formData.get("staff_note"), 3000) || null;

  if (
    !enrollmentId ||
    !["pending", "accepted", "training", "passed", "failed", "cancelled"].includes(status) ||
    (practicalScore != null && (practicalScore < 0 || practicalScore > 100))
  ) {
    redirect(`${EVAL_STAFF_PATH}?error=evaluation-invalid`);
  }

  const { supabase } = await requireAcademyStaff();

  if (status === "accepted") {
    const { data: enrollment } = await supabase
      .from("academy_enrollments_v137")
      .select("course_id")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (enrollment) {
      const [{ count }, { data: course }] = await Promise.all([
        supabase
          .from("academy_enrollments_v137")
          .select("id", { count: "exact", head: true })
          .eq("course_id", enrollment.course_id)
          .neq("id", enrollmentId)
          .in("status", ["accepted", "training"]),
        supabase
          .from("academy_courses_v137")
          .select("max_participants")
          .eq("id", enrollment.course_id)
          .maybeSingle(),
      ]);
      if (course && (count ?? 0) >= Number(course.max_participants)) {
        redirect(`${EVAL_STAFF_PATH}?error=full`);
      }
    }
  }

  const { error } = await supabase
    .from("academy_enrollments_v137")
    .update({
      status,
      practical_score: practicalScore,
      instructor_name: instructorName,
      staff_note: appreciation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);

  if (error) {
    const message = `${error.message ?? ""}`;
    const code = message.includes("passing_scores_required")
      ? "scores"
      : message.includes("academy_quiz_required")
        ? "quiz-required"
        : "evaluation";
    redirect(`${EVAL_STAFF_PATH}?error=${code}`);
  }

  refresh();
  redirect(`${EVAL_STAFF_PATH}?saved=1&enrollment=${enrollmentId}`);
}

export async function startAcademyQuizFromInvitationV147(formData: FormData) {
  const assignmentId = Math.floor(numberValue(formData.get("assignment_id")));
  const quizId = Math.floor(numberValue(formData.get("quiz_id")));
  if (!assignmentId || !quizId) redirect(`${PUBLIC_PATH}?error=quiz-start`);

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const { data, error } = await (supabase as any).rpc("academy_start_quiz_v143", {
    p_quiz_id: quizId,
  });

  if (error || !data) {
    const message = `${error?.message ?? ""}`;
    const code = message.includes("max_attempts_reached")
      ? "quiz-max"
      : message.includes("quiz_already_passed")
        ? "quiz-passed"
        : message.includes("quiz_not_assigned")
          ? "quiz-not-assigned"
          : message.includes("training_not_open")
            ? "quiz-not-open"
            : message.includes("quiz_has_no_questions")
              ? "quiz-empty"
              : "quiz-start";
    redirect(`${PUBLIC_PATH}/questionnaire/convocation/${assignmentId}?error=${code}`);
  }

  redirect(`${PUBLIC_PATH}/questionnaire/${Number(data)}`);
}
