import { cancelAcademyEnrollmentV137, enrollAcademyCourseV137 } from "@/app/actions/racing-academy";
import { getRequestUser } from "@/lib/auth/request-context";
import { getAcademyConfiguredV137, getAcademyCoursesV137, getAcademyEnrollmentsV137, getAcademyQualificationsV137 } from "@/lib/racing-academy/data";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = { pending: "Demande envoyée", accepted: "Inscription acceptée", training: "Formation en cours", passed: "Formation réussie", failed: "Formation non validée", cancelled: "Inscription annulée" };

export default async function RacingAcademyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, user, configured] = await Promise.all([searchParams, getRequestUser(), getAcademyConfiguredV137()]);
  const [courses, enrollments, qualifications] = user && configured ? await Promise.all([getAcademyCoursesV137(), getAcademyEnrollmentsV137(user.id), getAcademyQualificationsV137(user.id)]) : [[], [], []];
  const enrollmentByCourse = new Map(enrollments.map((row) => [row.courseId, row]));
  return <>
    <section className="page-hero"><span className="eyebrow">NOSTRA CIRCUIT</span><h1 className="page-title">Nostra Racing Academy</h1><p className="lead">Forme-toi avec les instructeurs du circuit, réussis les épreuves théoriques et pratiques, puis obtiens ta qualification officielle Academy.</p></section>
    {!configured ? <section className={styles.panel}><p className={styles.empty}>La Racing Academy ouvrira prochainement.</p></section> : <>
      {params.sent && <div className="dashboard-feedback dashboard-feedback-success">Ta demande d’inscription a été envoyée.</div>}
      {params.cancelled && <div className="dashboard-feedback">Ton inscription a été annulée.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">{params.error === "exists" ? "Tu as déjà un dossier pour cette formation." : params.error === "closed" ? "Les inscriptions à cette formation sont fermées." : "Impossible d’envoyer cette demande."}</div>}

      {qualifications.length > 0 && <section className={`${styles.panel} ${styles.section}`}><div className={styles.panelHeader}><div><h2>Mes qualifications</h2><p>Qualifications délivrées automatiquement après réussite des deux épreuves.</p></div></div><div className={styles.grid}>{qualifications.map((qualification) => <article className={styles.proposal} key={qualification.id}><span className={styles.badge}>{qualification.active ? "ACTIVE" : "SUSPENDUE"}</span><h3>{qualification.label}</h3><p><strong>{qualification.number}</strong></p><div className={styles.proposalGrid}><div>Théorie : <strong>{qualification.theoryScore}/100</strong></div><div>Pratique : <strong>{qualification.practicalScore}/100</strong></div></div><p>Délivrée le {new Date(qualification.issuedAt).toLocaleDateString("fr-FR")}</p></article>)}</div></section>}

      <section className={styles.section}><div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">FORMATIONS</p><h2>Programme disponible</h2></div><div className={styles.grid}>{courses.length === 0 && <article className={styles.panel}><p className={styles.empty}>Aucune formation ouverte pour le moment.</p></article>}{courses.map((course) => { const enrollment = enrollmentByCourse.get(course.id); return <article className={styles.panel} key={course.id}><div className={styles.caseHead}><div><span className={styles.badge}>{course.durationLabel}</span><h2>{course.title}</h2><p>{course.qualificationLabel}</p></div><strong>{course.maxParticipants} places</strong></div><p>{course.description}</p><div className={styles.detailsGrid}><div><span>Théorie minimale</span><strong>{course.theoryPassScore}/100</strong></div><div><span>Pratique minimale</span><strong>{course.practicalPassScore}/100</strong></div><div><span>Qualification</span><strong>{course.qualificationLabel}</strong></div><div><span>Capacité</span><strong>{course.maxParticipants}</strong></div></div>{enrollment ? <div className={styles.notice}><strong>{statusLabels[enrollment.status] ?? enrollment.status}</strong>{enrollment.staffNote && <p>{enrollment.staffNote}</p>}{enrollment.theoryScore != null && <p>Théorie : {enrollment.theoryScore}/100 · Pratique : {enrollment.practicalScore ?? "—"}/100</p>}{["pending", "accepted"].includes(enrollment.status) && <form action={cancelAcademyEnrollmentV137} className={styles.actions}><input type="hidden" name="enrollment_id" value={enrollment.id} /><button className={styles.secondary}>Annuler mon inscription</button></form>}</div> : <form action={enrollAcademyCourseV137} className={styles.form}><input type="hidden" name="course_id" value={course.id} /><label className={styles.span4}>Pourquoi souhaites-tu suivre cette formation ?<textarea name="motivation" rows={3} minLength={5} required /></label><button className={styles.primary}>Demander mon inscription</button></form>}</article>; })}</div></section>
    </>}
  </>;
}
