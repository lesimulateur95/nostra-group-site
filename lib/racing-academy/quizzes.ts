import { createClient } from "@/lib/supabase/server";

export type AcademyQuizV143 = {
  id: number;
  courseId: number | null;
  title: string;
  instructions: string | null;
  passScore: number;
  maxAttempts: number;
  timeLimitMinutes: number;
  questionCount: number;
  randomizeQuestions: boolean;
  showCorrection: boolean;
  active: boolean;
};

export type AcademyQuizQuestionV143 = {
  id: number;
  quizId: number;
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string | null;
  optionD: string | null;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
  points: number;
  sortOrder: number;
  active: boolean;
};

export type AcademyQuizAttemptV143 = {
  id: number;
  quizId: number;
  enrollmentId: number;
  userId: string;
  attemptNumber: number;
  status: "in_progress" | "passed" | "failed" | "expired";
  score: number | null;
  correctCount: number;
  totalQuestions: number;
  startedAt: string;
  submittedAt: string | null;
};

export type AcademyQuizPlayerQuestionV143 = {
  id: number;
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string | null;
  optionD: string | null;
  points: number;
  selectedOption: string | null;
  isCorrect: boolean | null;
  correctOption: string | null;
  explanation: string | null;
};

export type AcademyQuizAttemptDetailV143 = {
  id: number;
  status: AcademyQuizAttemptV143["status"];
  score: number | null;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  correctCount: number;
  totalQuestions: number;
  quizId: number;
  quizTitle: string;
  instructions: string | null;
  timeLimitMinutes: number;
  passScore: number;
  maxAttempts: number;
  courseId: number;
  courseTitle: string;
  questions: AcademyQuizPlayerQuestionV143[];
};

const quizColumns = "id,course_id,title,instructions,pass_score,max_attempts,time_limit_minutes,question_count,randomize_questions,show_correction,active";
const questionColumns = "id,quiz_id,prompt,option_a,option_b,option_c,option_d,correct_option,explanation,points,sort_order,active";
const attemptColumns = "id,quiz_id,enrollment_id,user_id,attempt_number,status,score,correct_count,total_questions,started_at,submitted_at";

function mapQuiz(row: Record<string, unknown>): AcademyQuizV143 {
  return {
    id: Number(row.id),
    courseId: row.course_id == null ? null : Number(row.course_id),
    title: String(row.title),
    instructions: typeof row.instructions === "string" ? row.instructions : null,
    passScore: Number(row.pass_score),
    maxAttempts: Number(row.max_attempts),
    timeLimitMinutes: Number(row.time_limit_minutes),
    questionCount: Number(row.question_count),
    randomizeQuestions: Boolean(row.randomize_questions),
    showCorrection: Boolean(row.show_correction),
    active: Boolean(row.active),
  };
}

function mapQuestion(row: Record<string, unknown>): AcademyQuizQuestionV143 {
  return {
    id: Number(row.id),
    quizId: Number(row.quiz_id),
    prompt: String(row.prompt),
    optionA: String(row.option_a),
    optionB: String(row.option_b),
    optionC: typeof row.option_c === "string" ? row.option_c : null,
    optionD: typeof row.option_d === "string" ? row.option_d : null,
    correctOption: String(row.correct_option) as AcademyQuizQuestionV143["correctOption"],
    explanation: typeof row.explanation === "string" ? row.explanation : null,
    points: Number(row.points),
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
  };
}

function mapAttempt(row: Record<string, unknown>): AcademyQuizAttemptV143 {
  return {
    id: Number(row.id),
    quizId: Number(row.quiz_id),
    enrollmentId: Number(row.enrollment_id),
    userId: String(row.user_id),
    attemptNumber: Number(row.attempt_number),
    status: String(row.status) as AcademyQuizAttemptV143["status"],
    score: row.score == null ? null : Number(row.score),
    correctCount: Number(row.correct_count ?? 0),
    totalQuestions: Number(row.total_questions ?? 0),
    startedAt: String(row.started_at),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
  };
}

export async function getAcademyQuizConfiguredV143(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await (supabase as any).from("academy_quizzes_v143").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function getAcademyQuizzesV143(includeInactive = false): Promise<AcademyQuizV143[]> {
  const supabase = await createClient();
  let query = (supabase as any).from("academy_quizzes_v143").select(quizColumns).order("course_id");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as Array<Record<string, unknown>>).map(mapQuiz);
}

export async function getAcademyQuizQuestionsV143(quizId?: number): Promise<AcademyQuizQuestionV143[]> {
  const supabase = await createClient();
  let query = (supabase as any).from("academy_quiz_questions_v143").select(questionColumns).order("sort_order").order("id");
  if (quizId) query = query.eq("quiz_id", quizId);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as Array<Record<string, unknown>>).map(mapQuestion);
}

export async function getAcademyQuizAttemptsV143(userId?: string): Promise<AcademyQuizAttemptV143[]> {
  const supabase = await createClient();
  let query = (supabase as any).from("academy_quiz_attempts_v143").select(attemptColumns).order("started_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  return error ? [] : ((data ?? []) as Array<Record<string, unknown>>).map(mapAttempt);
}

export async function getAcademyQuizAttemptDetailV143(attemptId: number): Promise<AcademyQuizAttemptDetailV143 | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("academy_get_quiz_attempt_v143", { p_attempt_id: attemptId });
    if (error || !data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    return {
      id: Number(row.id),
      status: String(row.status) as AcademyQuizAttemptDetailV143["status"],
      score: row.score == null ? null : Number(row.score),
      attemptNumber: Number(row.attemptNumber),
      startedAt: String(row.startedAt),
      submittedAt: row.submittedAt ? String(row.submittedAt) : null,
      correctCount: Number(row.correctCount ?? 0),
      totalQuestions: Number(row.totalQuestions ?? 0),
      quizId: Number(row.quizId),
      quizTitle: String(row.quizTitle),
      instructions: typeof row.instructions === "string" ? row.instructions : null,
      timeLimitMinutes: Number(row.timeLimitMinutes ?? 0),
      passScore: Number(row.passScore ?? 0),
      maxAttempts: Number(row.maxAttempts ?? 0),
      courseId: Number(row.courseId),
      courseTitle: String(row.courseTitle),
      questions: Array.isArray(row.questions) ? (row.questions as AcademyQuizPlayerQuestionV143[]) : [],
    };
  } catch {
    return null;
  }
}

export type AcademyQuizAssignmentV147 = {
  id: number;
  quizId: number;
  enrollmentId: number;
  userId: string;
  status: "sent" | "opened" | "in_progress" | "passed" | "failed" | "cancelled";
  sentBy: string | null;
  mailThreadId: string | null;
  lastAttemptId: number | null;
  sentAt: string;
  openedAt: string | null;
  completedAt: string | null;
};

export type AcademyQuizInvitationDetailV147 = {
  id: number;
  status: AcademyQuizAssignmentV147["status"];
  sentAt: string;
  openedAt: string | null;
  completedAt: string | null;
  quizId: number;
  quizTitle: string;
  instructions: string | null;
  passScore: number;
  maxAttempts: number;
  timeLimitMinutes: number;
  courseId: number;
  courseTitle: string;
  enrollmentId: number;
  attemptsUsed: number;
  bestScore: number | null;
};

const assignmentColumnsV147 = "id,quiz_id,enrollment_id,user_id,status,sent_by,mail_thread_id,last_attempt_id,sent_at,opened_at,completed_at";

function mapAssignmentV147(row: Record<string, unknown>): AcademyQuizAssignmentV147 {
  return {
    id: Number(row.id),
    quizId: Number(row.quiz_id),
    enrollmentId: Number(row.enrollment_id),
    userId: String(row.user_id),
    status: String(row.status) as AcademyQuizAssignmentV147["status"],
    sentBy: typeof row.sent_by === "string" ? row.sent_by : null,
    mailThreadId: typeof row.mail_thread_id === "string" ? row.mail_thread_id : null,
    lastAttemptId: row.last_attempt_id == null ? null : Number(row.last_attempt_id),
    sentAt: String(row.sent_at),
    openedAt: row.opened_at ? String(row.opened_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export async function getAcademyQuizAssignmentsV147(userId?: string): Promise<AcademyQuizAssignmentV147[]> {
  try {
    const supabase = await createClient();
    let query = (supabase as any)
      .from("academy_quiz_assignments_v147")
      .select(assignmentColumnsV147)
      .order("sent_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    return error ? [] : ((data ?? []) as Array<Record<string, unknown>>).map(mapAssignmentV147);
  } catch {
    return [];
  }
}

export async function getAcademyQuizInvitationV147(assignmentId: number): Promise<AcademyQuizInvitationDetailV147 | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("academy_open_quiz_invitation_v147", {
      p_assignment_id: assignmentId,
    });
    if (error || !data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    return {
      id: Number(row.id),
      status: String(row.status) as AcademyQuizInvitationDetailV147["status"],
      sentAt: String(row.sentAt),
      openedAt: row.openedAt ? String(row.openedAt) : null,
      completedAt: row.completedAt ? String(row.completedAt) : null,
      quizId: Number(row.quizId),
      quizTitle: String(row.quizTitle),
      instructions: typeof row.instructions === "string" ? row.instructions : null,
      passScore: Number(row.passScore ?? 0),
      maxAttempts: Number(row.maxAttempts ?? 0),
      timeLimitMinutes: Number(row.timeLimitMinutes ?? 0),
      courseId: Number(row.courseId),
      courseTitle: String(row.courseTitle),
      enrollmentId: Number(row.enrollmentId),
      attemptsUsed: Number(row.attemptsUsed ?? 0),
      bestScore: row.bestScore == null ? null : Number(row.bestScore),
    };
  } catch {
    return null;
  }
}
