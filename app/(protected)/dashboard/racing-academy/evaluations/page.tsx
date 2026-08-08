import Link from "next/link";

import {
  resetAcademyQuizAttemptsV143,
  saveAcademyParticipantEvaluationV147,
  sendAcademyQuizInvitationV147,
  sendAcademyQuizToCourseV147,
} from "@/app/actions/racing-academy";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AcademyLiveRefresh } from "@/components/racing-academy/academy-live-refresh";
import {
  getAcademyConfiguredV137,
  getAcademyCoursesV137,
  getAcademyEnrollmentsV137,
} from "@/lib/racing-academy/data";
import {
  getAcademyQuizAssignmentsV147,
  getAcademyQuizAttemptDetailV143,
  getAcademyQuizAttemptsV143,
  getAcademyQuizConfiguredV143,
  getAcademyQuizzesV143,
  type AcademyQuizAttemptDetailV143,
} from "@/lib/racing-academy/quizzes";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  pending: "Nouvelle demande",
  accepted: "Acceptée",
  training: "En formation",
  passed: "Réussie",
  failed: "Échouée",
  cancelled: "Annulée",
};

const assignmentLabels: Record<string, string> = {
  sent: "ENVOYÉ PAR MAIL",
  opened: "CONVOCATION OUVERTE",
  in_progress: "QUESTIONNAIRE EN COURS",
  passed: "QCM RÉUSSI",
  failed: "QCM À REPASSER",
  cancelled: "ENVOI ANNULÉ",
};

const errors: Record<string, string> = {
  "quiz-inactive": "Le questionnaire de cette formation doit être activé avant l’envoi.",
  "quiz-empty": "Le questionnaire ne contient aucune question active.",
  "participant-not-ready": "Le candidat doit d’abord être accepté ou placé en formation.",
  "quiz-passed": "Ce candidat a déjà validé le questionnaire.",
  mail: "La boîte mail Nostra n’est pas disponible pour ce citoyen.",
  invite: "Impossible d’envoyer le questionnaire.",
  "invite-invalid": "Participant invalide.",
  "evaluation-invalid": "Les informations d’évaluation sont invalides.",
  scores: "Les notes minimales sont nécessaires pour valider la formation.",
  "quiz-required": "Impossible de valider la formation : le questionnaire théorique n’est pas encore réussi.",
  full: "Cette formation a atteint sa capacité maximale.",
  evaluation: "Impossible d’enregistrer l’évaluation.",
};

function answerLabel(question: AcademyQuizAttemptDetailV143["questions"][number], letter: string | null) {
  if (!letter) return "Aucune réponse";
  const labels: Record<string, string | null> = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };
  return `${letter} · ${labels[letter] ?? ""}`;
}

export default async function AcademyEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, configured, quizConfigured] = await Promise.all([
    searchParams,
    getAcademyConfiguredV137(),
    getAcademyQuizConfiguredV143(),
  ]);

  const [courses, enrollments, quizzes, attempts, assignments] = configured
    ? await Promise.all([
        getAcademyCoursesV137(true),
        getAcademyEnrollmentsV137(),
        quizConfigured ? getAcademyQuizzesV143(true) : Promise.resolve([]),
        quizConfigured ? getAcademyQuizAttemptsV143() : Promise.resolve([]),
        quizConfigured ? getAcademyQuizAssignmentsV147() : Promise.resolve([]),
      ])
    : [[], [], [], [], []];

  const quizByCourse = new Map(quizzes.map((quiz) => [quiz.courseId, quiz]));
  const assignmentByEnrollment = new Map(assignments.map((row) => [row.enrollmentId, row]));
  const attemptsByEnrollment = new Map<number, typeof attempts>();
  for (const attempt of attempts) {
    const list = attemptsByEnrollment.get(attempt.enrollmentId) ?? [];
    list.push(attempt);
    attemptsByEnrollment.set(attempt.enrollmentId, list);
  }

  const lastCompletedAttemptIds = Array.from(
    new Set(
      enrollments
        .map((enrollment) => {
          const assignment = assignmentByEnrollment.get(enrollment.id);
          if (assignment?.lastAttemptId) return assignment.lastAttemptId;
          return (attemptsByEnrollment.get(enrollment.id) ?? []).find((attempt) => attempt.status !== "in_progress")?.id ?? null;
        })
        .filter((value): value is number => Boolean(value)),
    ),
  );

  const details = await Promise.all(lastCompletedAttemptIds.map((id) => getAcademyQuizAttemptDetailV143(id)));
  const detailByAttemptId = new Map(
    details.filter((detail): detail is AcademyQuizAttemptDetailV143 => Boolean(detail)).map((detail) => [detail.id, detail]),
  );

  return (
    <DashboardShell allowedRoles={["manager", "commissioner"]}>
      <DashboardHeader
        title="Participants & évaluations Academy"
        description="Pilote les questionnaires en direct : envoi par messagerie Nostra, correction automatique, pratique, appréciation et validation finale."
      />

      <div className={styles.actions}>
        <Link href="/dashboard/racing-academy" className={styles.secondary}>← Retour à la Racing Academy</Link>
        <Link href="/dashboard/racing-academy/questionnaires" className={styles.secondary}>Configurer les questionnaires</Link>
        <AcademyLiveRefresh />
      </div>

      {params.sent && <div className="dashboard-feedback dashboard-feedback-success">Questionnaire envoyé dans la boîte mail Nostra du citoyen.</div>}
      {params.sent_all && <div className="dashboard-feedback dashboard-feedback-success">{params.sent_all} questionnaire(s) envoyé(s) aux participants de la formation.</div>}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Évaluation du participant enregistrée.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">{errors[params.error] ?? "Impossible d’effectuer cette action."}</div>}

      {!configured || !quizConfigured ? (
        <section className={styles.panel}>
          <h2>Module questionnaires à activer</h2>
          <p>Installe d’abord le module Questionnaires Academy, puis le SQL V147.</p>
        </section>
      ) : (
        <section className={styles.section}>
          <div className="dashboard-section-heading dashboard-section-heading-tight">
            <p className="eyebrow">NOSTRA RACING ACADEMY · RÉGIE FORMATION</p>
            <h2>Participants par formation</h2>
          </div>

          <div className={styles.stack}>
            {courses.length === 0 && (
              <div className={styles.panel}>
                <h2>Aucune formation Academy à afficher</h2>
                <p>Cette page sert uniquement à piloter les participants d’une formation. Crée tes questionnaires dans la bibliothèque, puis crée une formation quand tu es prêt à inscrire des citoyens.</p>
                <div className={styles.actions}>
                  <Link href="/dashboard/racing-academy/questionnaires" className={styles.primary}>Créer un questionnaire</Link>
                  <Link href="/dashboard/racing-academy" className={styles.secondary}>Créer / gérer les formations</Link>
                </div>
              </div>
            )}
            {courses.map((course) => {
              const courseEnrollments = enrollments.filter((row) => row.courseId === course.id);
              const quiz = quizByCourse.get(course.id);
              const canBulkSend = Boolean(quiz?.active && courseEnrollments.some((row) => ["accepted", "training", "failed"].includes(row.status)));

              return (
                <details className={styles.panel} key={course.id} open={params.course === String(course.id)}>
                  <summary>
                    <strong>{course.title}</strong> · {courseEnrollments.length} participant(s) · {quiz?.active ? "QCM actif" : "QCM désactivé"}
                  </summary>

                  <div className={styles.panelHeader}>
                    <div>
                      <h2>{course.title}</h2>
                      <p>Théorie requise : {course.theoryPassScore}/100 · Pratique requise : {course.practicalPassScore}/100.</p>
                    </div>
                    <form action={sendAcademyQuizToCourseV147}>
                      <input type="hidden" name="course_id" value={course.id} />
                      <button className={styles.primary} disabled={!canBulkSend}>Envoyer le QCM à tous les participants</button>
                    </form>
                  </div>

                  {!quiz?.active && (
                    <div className="dashboard-feedback dashboard-feedback-error">
                      Le questionnaire de cette formation est désactivé. Active-le dans « Configurer les questionnaires » avant de l’envoyer.
                    </div>
                  )}

                  {courseEnrollments.length === 0 ? (
                    <p className={styles.empty}>Aucun participant inscrit à cette formation.</p>
                  ) : (
                    <div className={styles.stack}>
                      {courseEnrollments.map((row) => {
                        const assignment = assignmentByEnrollment.get(row.id);
                        const participantAttempts = attemptsByEnrollment.get(row.id) ?? [];
                        const lastAttemptId = assignment?.lastAttemptId ?? participantAttempts.find((attempt) => attempt.status !== "in_progress")?.id ?? null;
                        const detail = lastAttemptId ? detailByAttemptId.get(lastAttemptId) : null;
                        const canSend = Boolean(quiz?.active && ["accepted", "training", "failed"].includes(row.status) && assignment?.status !== "passed");

                        return (
                          <article className={styles.caseCard} key={row.id}>
                            <div className={styles.caseHead}>
                              <div>
                                <span className={styles.badge}>{statusLabels[row.status] ?? row.status}</span>
                                <h3>{row.applicantName}</h3>
                                <p>Inscription du {new Date(row.appliedAt).toLocaleDateString("fr-FR")}</p>
                              </div>
                              <div className={styles.badges}>
                                <span className={styles.badge}>{assignment ? assignmentLabels[assignment.status] ?? assignment.status : "QCM NON ENVOYÉ"}</span>
                                {row.theoryScore != null && <span className={styles.badge}>Théorie {row.theoryScore}/100</span>}
                                {row.practicalScore != null && <span className={styles.badge}>Pratique {row.practicalScore}/100</span>}
                              </div>
                            </div>

                            <div className={styles.detailsGrid}>
                              <div><span>Questionnaire</span><strong>{quiz?.title ?? "Non configuré"}</strong></div>
                              <div><span>Envoi</span><strong>{assignment ? new Date(assignment.sentAt).toLocaleString("fr-FR") : "Non envoyé"}</strong></div>
                              <div><span>Tentatives</span><strong>{participantAttempts.filter((attempt) => attempt.status !== "in_progress").length}/{quiz?.maxAttempts ?? 0}</strong></div>
                              <div><span>Résultat théorie</span><strong>{row.theoryScore == null ? "En attente" : `${row.theoryScore}/100`}</strong></div>
                            </div>

                            <div className={styles.actions}>
                              <form action={sendAcademyQuizInvitationV147}>
                                <input type="hidden" name="enrollment_id" value={row.id} />
                                <button className={styles.primary} disabled={!canSend}>
                                  {assignment ? "Renvoyer la convocation par mail" : "Envoyer le questionnaire par mail"}
                                </button>
                              </form>
                              {quiz && participantAttempts.length > 0 && (
                                <form action={resetAcademyQuizAttemptsV143}>
                                  <input type="hidden" name="enrollment_id" value={row.id} />
                                  <input type="hidden" name="quiz_id" value={quiz.id} />
                                  <input type="hidden" name="return_to" value="evaluations" />
                                  <button className={styles.secondary}>Réinitialiser les tentatives</button>
                                </form>
                              )}
                            </div>

                            {detail && detail.status !== "in_progress" && (
                              <details className={styles.notice} open={params.enrollment === String(row.id)}>
                                <summary>
                                  <strong>Correction automatique · {detail.score ?? 0}/100 · {detail.correctCount}/{detail.totalQuestions} bonnes réponses</strong>
                                </summary>
                                <div className={styles.stack}>
                                  {detail.questions.map((question, index) => (
                                    <article className={styles.proposal} key={question.id}>
                                      <h4>Question {index + 1} · {question.isCorrect ? "✓ Correcte" : "✕ Incorrecte"}</h4>
                                      <p>{question.prompt}</p>
                                      <p>Réponse du candidat : <strong>{answerLabel(question, question.selectedOption)}</strong></p>
                                      <p>Bonne réponse : <strong>{answerLabel(question, question.correctOption)}</strong></p>
                                      {question.explanation && <p>Correction : {question.explanation}</p>}
                                    </article>
                                  ))}
                                </div>
                              </details>
                            )}

                            <form action={saveAcademyParticipantEvaluationV147} className={styles.form}>
                              <input type="hidden" name="enrollment_id" value={row.id} />
                              <label>
                                Statut du dossier
                                <select name="status" defaultValue={row.status}>
                                  <option value="pending">Nouvelle demande</option>
                                  <option value="accepted">Acceptée</option>
                                  <option value="training">En formation</option>
                                  <option value="passed">Réussie</option>
                                  <option value="failed">Échouée</option>
                                  <option value="cancelled">Annulée</option>
                                </select>
                              </label>
                              <label>
                                Note théorie /100
                                <input value={row.theoryScore ?? "En attente du QCM"} readOnly aria-readonly="true" />
                                <small>Calculée automatiquement après l’envoi et la correction du questionnaire.</small>
                              </label>
                              <label>
                                Note pratique /100
                                <input name="practical_score" type="number" min="0" max="100" step="0.01" defaultValue={row.practicalScore ?? ""} />
                              </label>
                              <label>
                                Instructeur
                                <input name="instructor_name" defaultValue={row.instructorName ?? ""} />
                              </label>
                              <label className={styles.span4}>
                                Appréciation / compte rendu visible par le pilote
                                <textarea name="staff_note" rows={4} defaultValue={row.staffNote ?? ""} placeholder="Comportement, maîtrise, points à améliorer, appréciation générale…" />
                              </label>
                              <button className={styles.primary}>Enregistrer l’évaluation</button>
                            </form>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
