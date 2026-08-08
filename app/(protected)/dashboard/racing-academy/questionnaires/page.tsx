import Link from "next/link";

import {
  createAcademyQuizV1471,
  deleteAcademyQuizQuestionV1471,
  deleteAcademyQuizV1471,
  resetAcademyQuizAttemptsV143,
  saveAcademyQuizQuestionV143,
  saveAcademyQuizSettingsV143,
  syncAcademyQuizzesV1471,
  toggleAcademyQuizQuestionV143,
} from "@/app/actions/racing-academy";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAcademyCoursesV137, getAcademyEnrollmentsV137 } from "@/lib/racing-academy/data";
import {
  getAcademyQuizAttemptsV143,
  getAcademyQuizConfiguredV143,
  getAcademyQuizQuestionsV143,
  getAcademyQuizzesV143,
  type AcademyQuizQuestionV143,
  type AcademyQuizV143,
} from "@/lib/racing-academy/quizzes";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const attemptLabels: Record<string, string> = {
  in_progress: "EN COURS",
  passed: "RÉUSSI",
  failed: "ÉCHOUÉ",
  expired: "TEMPS ÉCOULÉ",
};

export default async function AcademyQuestionnairesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, configured] = await Promise.all([searchParams, getAcademyQuizConfiguredV143()]);

  const [courses, quizzes, questions, attempts, enrollments] = configured
    ? await Promise.all([
        getAcademyCoursesV137(true),
        getAcademyQuizzesV143(true),
        getAcademyQuizQuestionsV143(),
        getAcademyQuizAttemptsV143(),
        getAcademyEnrollmentsV137(),
      ])
    : [[], [], [], [], []];

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const quizCourseIds = new Set(quizzes.map((quiz) => quiz.courseId));
  const coursesWithoutQuiz = courses.filter((course) => !quizCourseIds.has(course.id));
  const enrollmentById = new Map(enrollments.map((row) => [row.id, row]));
  const questionsByQuiz = new Map<number, AcademyQuizQuestionV143[]>();
  for (const question of questions) {
    const list = questionsByQuiz.get(question.quizId) ?? [];
    list.push(question);
    questionsByQuiz.set(question.quizId, list);
  }

  const attemptsByQuiz = new Map<number, typeof attempts>();
  for (const attempt of attempts) {
    const list = attemptsByQuiz.get(attempt.quizId) ?? [];
    list.push(attempt);
    attemptsByQuiz.set(attempt.quizId, list);
  }

  return (
    <DashboardShell allowedRoles={["manager", "commissioner"]}>
      <DashboardHeader
        title="Questionnaires Academy"
        description="Examens théoriques sécurisés, chrono, tentatives, correction automatique et liaison directe aux formations."
      />

      <div className={styles.actions}><Link href="/dashboard/racing-academy" className={styles.secondary}>← Retour à la Nostra Racing Academy</Link><Link href="/dashboard/racing-academy/evaluations" className={styles.primary}>Participants & évaluations</Link></div>

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Exécute le SQL V143</h2>
          <p>Les questionnaires de formation apparaîtront ensuite sur cette page.</p>
        </section>
      ) : (
        <>
          {params.quiz && <div className="dashboard-feedback dashboard-feedback-success">Configuration du questionnaire enregistrée.</div>}
          {params.created && <div className="dashboard-feedback dashboard-feedback-success">Questionnaire créé.</div>}
          {params.deleted && <div className="dashboard-feedback dashboard-feedback-success">Questionnaire supprimé.</div>}
          {params.synced != null && <div className="dashboard-feedback dashboard-feedback-success">Synchronisation terminée : {params.synced} questionnaire(s) manquant(s) créé(s).</div>}
          {params.question && <div className="dashboard-feedback dashboard-feedback-success">Question enregistrée.</div>}
          {params.question_deleted && <div className="dashboard-feedback dashboard-feedback-success">Question supprimée.</div>}
          {params.reset && <div className="dashboard-feedback dashboard-feedback-success">Tentatives du candidat réinitialisées.</div>}
          {params.error && (
            <div className="dashboard-feedback dashboard-feedback-error">
              {params.error === "question-invalid"
                ? "La question est incomplète ou la bonne réponse ne correspond à aucune proposition."
                : params.error === "quiz-invalid"
                  ? "La configuration du questionnaire est invalide."
                  : params.error === "quiz-exists"
                    ? "Cette formation possède déjà un questionnaire."
                    : params.error === "quiz-create"
                      ? "Impossible de créer le questionnaire."
                      : params.error === "quiz-delete"
                        ? "Impossible de supprimer le questionnaire."
                        : params.error === "quiz-sync"
                          ? "Impossible de générer les questionnaires manquants."
                          : params.error === "question-used"
                            ? "Cette question a déjà été utilisée dans une tentative. Désactive-la au lieu de la supprimer pour conserver l’historique."
                            : params.error === "question-delete"
                              ? "Impossible de supprimer la question."
                              : "Impossible d’enregistrer cette action."}
            </div>
          )}

          <section className={styles.section}>
            <div className="dashboard-section-heading dashboard-section-heading-tight">
              <p className="eyebrow">GESTION</p>
              <h2>Créer ou synchroniser les questionnaires</h2>
              <p>Un questionnaire est lié à une formation. Tu peux le créer manuellement ou générer automatiquement tous ceux qui manquent.</p>
            </div>
            <div className={styles.panel}>
              <div className={styles.actions}>
                <form action={syncAcademyQuizzesV1471}>
                  <button className={styles.secondary}>Générer les questionnaires manquants</button>
                </form>
              </div>
              {coursesWithoutQuiz.length > 0 ? (
                <form action={createAcademyQuizV1471} className={styles.form}>
                  <label>Formation
                    <select name="course_id" required defaultValue="">
                      <option value="" disabled>Choisir une formation</option>
                      {coursesWithoutQuiz.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                  </label>
                  <label className={styles.span2}>Nom du questionnaire
                    <input name="title" placeholder="Ex. Examen théorique GT3 RS" required />
                  </label>
                  <button className={styles.primary}>Créer le questionnaire</button>
                </form>
              ) : (
                <p className={styles.empty}>{courses.length === 0 ? "Aucune formation Academy n’est encore créée." : "Toutes les formations possèdent déjà leur questionnaire."}</p>
              )}
            </div>
          </section>

          <section className={styles.kpis}>
            <article className={styles.kpi}><span>Questionnaires</span><strong>{quizzes.length}</strong></article>
            <article className={styles.kpi}><span>QCM actifs</span><strong>{quizzes.filter((quiz) => quiz.active).length}</strong></article>
            <article className={styles.kpi}><span>Questions actives</span><strong>{questions.filter((question) => question.active).length}</strong></article>
            <article className={styles.kpi}><span>Tentatives réussies</span><strong>{attempts.filter((attempt) => attempt.status === "passed").length}</strong></article>
          </section>

          <section className={styles.section}>
            <div className="dashboard-section-heading dashboard-section-heading-tight">
              <p className="eyebrow">FORMATIONS</p>
              <h2>Questionnaires par formation</h2>
            </div>
            <div className={styles.stack}>
              {quizzes.length === 0 && (
                <div className={styles.empty}>
                  Aucun questionnaire n’est encore enregistré. Utilise le bloc « Créer ou synchroniser les questionnaires » ci-dessus.
                </div>
              )}
              {quizzes.map((quiz) => {
                const course = courseById.get(quiz.courseId);
                const quizQuestions = questionsByQuiz.get(quiz.id) ?? [];
                const quizAttempts = attemptsByQuiz.get(quiz.id) ?? [];
                return (
                  <details className={styles.panel} key={quiz.id} open={params.quiz === String(quiz.id) || params.course === String(quiz.courseId)}>
                    <summary>
                      <strong>{course?.title ?? quiz.title}</strong> · {quiz.active ? "QCM ACTIF" : "QCM DÉSACTIVÉ"} · {quizQuestions.filter((q) => q.active).length} question(s)
                    </summary>

                    <div className={styles.panelHeader}>
                      <div>
                        <span className={styles.badge}>{quiz.active ? "OBLIGATOIRE POUR VALIDER" : "NON BLOQUANT"}</span>
                        <h2>{quiz.title}</h2>
                        <p>Seuil Academy de la formation : {course?.theoryPassScore ?? 0}/100. Le seuil réellement exigé sera toujours le plus élevé entre ce seuil et celui du questionnaire.</p>
                      </div>
                    </div>

                    <QuizSettingsForm quiz={quiz} courseTitle={course?.title ?? "Formation"} courseTheoryScore={course?.theoryPassScore ?? 70} />
                    <form action={deleteAcademyQuizV1471} className={styles.actions}>
                      <input type="hidden" name="quiz_id" value={quiz.id} />
                      <button className={styles.danger}>Supprimer définitivement ce questionnaire</button>
                    </form>

                    <hr />
                    <div className={styles.panelHeader}>
                      <div>
                        <h3>Ajouter une question</h3>
                        <p>Deux réponses minimum, quatre maximum. La bonne réponse reste cachée côté citoyen.</p>
                      </div>
                    </div>
                    <QuestionForm quizId={quiz.id} sortOrder={quizQuestions.length + 1} />

                    <div className={styles.stack}>
                      {quizQuestions.length === 0 && <p className={styles.empty}>Aucune question. Le questionnaire ne pourra pas être démarré.</p>}
                      {quizQuestions.map((question, index) => (
                        <details className={styles.notice} key={question.id}>
                          <summary>
                            <strong>Q{index + 1}.</strong> {question.prompt} · bonne réponse {question.correctOption} · {question.active ? "ACTIVE" : "DÉSACTIVÉE"}
                          </summary>
                          <QuestionForm quizId={quiz.id} question={question} sortOrder={question.sortOrder} />
                          <div className={styles.actions}>
                            <form action={toggleAcademyQuizQuestionV143}>
                              <input type="hidden" name="question_id" value={question.id} />
                              <input type="hidden" name="quiz_id" value={quiz.id} />
                              <input type="hidden" name="active" value={question.active ? "false" : "true"} />
                              <button className={styles.secondary}>{question.active ? "Désactiver la question" : "Réactiver la question"}</button>
                            </form>
                            <form action={deleteAcademyQuizQuestionV1471}>
                              <input type="hidden" name="question_id" value={question.id} />
                              <input type="hidden" name="quiz_id" value={quiz.id} />
                              <button className={styles.danger}>Supprimer la question</button>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>

                    <hr />
                    <div className={styles.panelHeader}>
                      <div>
                        <h3>Résultats et tentatives</h3>
                        <p>La réinitialisation redonne toutes les tentatives au candidat et efface sa note théorique issue de ce QCM.</p>
                      </div>
                    </div>
                    <div className={styles.stack}>
                      {quizAttempts.length === 0 && <p className={styles.empty}>Aucune tentative pour ce questionnaire.</p>}
                      {quizAttempts.map((attempt) => {
                        const enrollment = enrollmentById.get(attempt.enrollmentId);
                        return (
                          <article className={styles.notice} key={attempt.id}>
                            <strong>{enrollment?.applicantName ?? "Candidat"}</strong> · tentative {attempt.attemptNumber} · {attemptLabels[attempt.status] ?? attempt.status}
                            <p>Score : {attempt.score == null ? "—" : `${attempt.score}/100`} · {attempt.correctCount}/{attempt.totalQuestions} bonne(s) réponse(s) · {new Date(attempt.startedAt).toLocaleString("fr-FR")}</p>
                            <form action={resetAcademyQuizAttemptsV143} className={styles.actions}>
                              <input type="hidden" name="enrollment_id" value={attempt.enrollmentId} />
                              <input type="hidden" name="quiz_id" value={quiz.id} />
                              <button className={styles.secondary}>Réinitialiser toutes ses tentatives</button>
                            </form>
                          </article>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}

function QuizSettingsForm({ quiz, courseTitle, courseTheoryScore }: { quiz: AcademyQuizV143; courseTitle: string; courseTheoryScore: number }) {
  return (
    <form action={saveAcademyQuizSettingsV143} className={styles.form}>
      <input type="hidden" name="quiz_id" value={quiz.id} />
      <input type="hidden" name="course_id" value={quiz.courseId} />
      <label className={styles.span2}>Nom du questionnaire<input name="title" defaultValue={quiz.title || `Questionnaire · ${courseTitle}`} required /></label>
      <label>Seuil QCM /100<input name="pass_score" type="number" min="0" max="100" step="0.01" defaultValue={quiz.passScore || courseTheoryScore} required /></label>
      <label>Nombre de tentatives<input name="max_attempts" type="number" min="1" max="20" defaultValue={quiz.maxAttempts} required /></label>
      <label>Chrono (minutes)<input name="time_limit_minutes" type="number" min="0" max="180" defaultValue={quiz.timeLimitMinutes} /><small>0 = aucun chrono.</small></label>
      <label>Questions tirées<input name="question_count" type="number" min="0" max="200" defaultValue={quiz.questionCount} /><small>0 = toutes les questions actives.</small></label>
      <label>Ordre des questions<select name="randomize_questions" defaultValue={quiz.randomizeQuestions ? "true" : "false"}><option value="true">Aléatoire à chaque tentative</option><option value="false">Ordre défini</option></select></label>
      <label>Correction après résultat<select name="show_correction" defaultValue={quiz.showCorrection ? "true" : "false"}><option value="true">Afficher</option><option value="false">Cacher</option></select></label>
      <label>État<select name="active" defaultValue={quiz.active ? "true" : "false"}><option value="true">Actif et obligatoire</option><option value="false">Désactivé</option></select></label>
      <label className={styles.span4}>Consignes<textarea name="instructions" rows={3} defaultValue={quiz.instructions ?? ""} placeholder="Ex. Une seule réponse par question. Toute tentative commencée compte." /></label>
      <button className={styles.primary}>Enregistrer le questionnaire</button>
    </form>
  );
}

function QuestionForm({ quizId, question, sortOrder }: { quizId: number; question?: AcademyQuizQuestionV143; sortOrder: number }) {
  return (
    <form action={saveAcademyQuizQuestionV143} className={styles.form}>
      <input type="hidden" name="quiz_id" value={quizId} />
      {question && <input type="hidden" name="question_id" value={question.id} />}
      <label className={styles.span4}>Question<textarea name="prompt" rows={2} defaultValue={question?.prompt ?? ""} required /></label>
      <label>Réponse A<input name="option_a" defaultValue={question?.optionA ?? ""} required /></label>
      <label>Réponse B<input name="option_b" defaultValue={question?.optionB ?? ""} required /></label>
      <label>Réponse C<input name="option_c" defaultValue={question?.optionC ?? ""} /></label>
      <label>Réponse D<input name="option_d" defaultValue={question?.optionD ?? ""} /></label>
      <label>Bonne réponse<select name="correct_option" defaultValue={question?.correctOption ?? "A"}><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label>
      <label>Points<input name="points" type="number" min="1" max="100" defaultValue={question?.points ?? 1} /></label>
      <label>Ordre<input name="sort_order" type="number" defaultValue={sortOrder} /></label>
      <label>État<select name="active" defaultValue={question?.active === false ? "false" : "true"}><option value="true">Active</option><option value="false">Désactivée</option></select></label>
      <label className={styles.span4}>Explication de correction<textarea name="explanation" rows={2} defaultValue={question?.explanation ?? ""} placeholder="Facultatif : explication affichée après la correction si autorisée." /></label>
      <button className={styles.primary}>{question ? "Enregistrer la question" : "Ajouter la question"}</button>
    </form>
  );
}
