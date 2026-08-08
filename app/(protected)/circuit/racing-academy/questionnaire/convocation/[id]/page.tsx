import Link from "next/link";
import { notFound } from "next/navigation";

import { startAcademyQuizFromInvitationV147 } from "@/app/actions/racing-academy";
import { getAcademyQuizInvitationV147 } from "@/lib/racing-academy/quizzes";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const errors: Record<string, string> = {
  "quiz-max": "Toutes les tentatives autorisées ont été utilisées. Ton instructeur doit les réinitialiser.",
  "quiz-passed": "Ce questionnaire est déjà validé.",
  "quiz-not-assigned": "Ce questionnaire n’est plus autorisé pour ton dossier.",
  "quiz-not-open": "Ta formation n’est pas dans un état permettant de passer le questionnaire.",
  "quiz-empty": "Le questionnaire ne contient aucune question active.",
  "quiz-start": "Impossible de démarrer le questionnaire pour le moment.",
};

export default async function AcademyQuizInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const invitation = await getAcademyQuizInvitationV147(Number(id));
  if (!invitation) notFound();

  const passed = invitation.status === "passed";
  const attemptsLeft = Math.max(0, invitation.maxAttempts - invitation.attemptsUsed);

  return (
    <>
      <section className="page-hero">
        <span className="eyebrow">NOSTRA RACING ACADEMY · CONVOCATION</span>
        <h1 className="page-title">Questionnaire théorique</h1>
        <p className="lead">{invitation.courseTitle}</p>
      </section>

      {query.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {errors[query.error] ?? "Impossible de démarrer le questionnaire."}
        </div>
      )}

      <section className={styles.panel}>
        <div className={styles.caseHead}>
          <div>
            <span className={styles.badge}>{passed ? "QUESTIONNAIRE VALIDÉ" : "CONVOCATION INSTRUCTEUR"}</span>
            <h2>{invitation.quizTitle}</h2>
            <p>Cette épreuve t’a été envoyée par l’équipe Nostra Racing Academy.</p>
          </div>
          {invitation.bestScore != null && <strong>Meilleur score : {invitation.bestScore}/100</strong>}
        </div>

        <div className={styles.detailsGrid}>
          <div><span>Objectif</span><strong>{invitation.passScore}/100</strong></div>
          <div><span>Chrono</span><strong>{invitation.timeLimitMinutes > 0 ? `${invitation.timeLimitMinutes} min` : "Sans chrono"}</strong></div>
          <div><span>Tentatives utilisées</span><strong>{invitation.attemptsUsed}/{invitation.maxAttempts}</strong></div>
          <div><span>Tentatives restantes</span><strong>{attemptsLeft}</strong></div>
        </div>

        {invitation.instructions && <div className={styles.notice}>{invitation.instructions}</div>}

        {!passed && attemptsLeft > 0 ? (
          <div className={styles.notice}>
            <strong>Le chronomètre ne démarre pas encore.</strong>
            <p>Il commencera uniquement lorsque tu cliqueras sur « Commencer le questionnaire ». Une fois commencé, toute tentative compte.</p>
          </div>
        ) : null}

        <div className={styles.actions}>
          {!passed && attemptsLeft > 0 && (
            <form action={startAcademyQuizFromInvitationV147}>
              <input type="hidden" name="assignment_id" value={invitation.id} />
              <input type="hidden" name="quiz_id" value={invitation.quizId} />
              <button className={styles.primary}>
                {invitation.status === "in_progress" ? "Reprendre mon questionnaire" : invitation.status === "failed" ? "Repasser le questionnaire" : "Commencer le questionnaire"}
              </button>
            </form>
          )}
          <Link href="/circuit/racing-academy" className={styles.secondary}>Retour à mes formations</Link>
          <Link href="/profil/messagerie" className={styles.secondary}>Retour à ma boîte mail</Link>
        </div>
      </section>
    </>
  );
}
