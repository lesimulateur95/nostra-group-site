import Link from "next/link";
import { notFound } from "next/navigation";

import { AcademyQuizPlayer } from "@/components/racing-academy/academy-quiz-player";
import { getAcademyQuizAttemptDetailV143 } from "@/lib/racing-academy/quizzes";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AcademyQuizAttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const attempt = await getAcademyQuizAttemptDetailV143(Number(id));
  if (!attempt) notFound();

  const completed = attempt.status !== "in_progress";
  const passed = attempt.status === "passed";

  return <>
    <section className="page-hero">
      <span className="eyebrow">NOSTRA RACING ACADEMY · EXAMEN THÉORIQUE</span>
      <h1 className="page-title">{attempt.quizTitle}</h1>
      <p className="lead">{attempt.courseTitle} · tentative {attempt.attemptNumber}/{attempt.maxAttempts}</p>
    </section>

    {query.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de corriger le questionnaire. Réessaie.</div>}

    {!completed ? <AcademyQuizPlayer attempt={attempt} /> : <section className={styles.panel}>
      <div className={styles.caseHead}>
        <div>
          <span className={styles.badge}>{passed ? "QUESTIONNAIRE VALIDÉ" : attempt.status === "expired" ? "TEMPS ÉCOULÉ" : "QUESTIONNAIRE NON VALIDÉ"}</span>
          <h2>{passed ? "Épreuve théorique réussie" : "Résultat de la tentative"}</h2>
          <p>Ta meilleure note théorique est automatiquement enregistrée dans ton dossier Academy.</p>
        </div>
        <strong>{attempt.score ?? 0}/100</strong>
      </div>

      <div className={styles.detailsGrid}>
        <div><span>Objectif</span><strong>{attempt.passScore}/100</strong></div>
        <div><span>Bonnes réponses</span><strong>{attempt.correctCount}/{attempt.totalQuestions}</strong></div>
        <div><span>Tentative</span><strong>{attempt.attemptNumber}/{attempt.maxAttempts}</strong></div>
        <div><span>Résultat</span><strong>{passed ? "RÉUSSI" : "À REPASSER"}</strong></div>
      </div>

      <div className={styles.stack}>
        {attempt.questions.map((question, index) => (
          <article className={styles.notice} key={question.id}>
            <strong>Question {index + 1} · {question.isCorrect ? "✓ Correct" : "✕ Incorrect"}</strong>
            <p>{question.prompt}</p>
            <p>Ta réponse : <strong>{question.selectedOption ?? "Aucune réponse"}</strong>{question.correctOption ? ` · Bonne réponse : ${question.correctOption}` : ""}</p>
            {question.explanation && <p>{question.explanation}</p>}
          </article>
        ))}
      </div>

      <div className={styles.actions}>
        <Link href="/circuit/racing-academy" className={styles.primary}>{passed ? "Retour à mes formations" : "Retour pour voir mes tentatives"}</Link>
      </div>
    </section>}
  </>;
}
