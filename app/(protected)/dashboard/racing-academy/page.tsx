import { reviewAcademyEnrollmentV137, saveAcademyCourseV137 } from "@/app/actions/racing-academy";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAcademyConfiguredV137, getAcademyCoursesV137, getAcademyEnrollmentsV137, getAcademyQualificationsV137 } from "@/lib/racing-academy/data";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = { pending: "Nouvelle demande", accepted: "Acceptée", training: "En formation", passed: "Réussie", failed: "Échouée", cancelled: "Annulée" };

export default async function AcademyDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, configured] = await Promise.all([searchParams, getAcademyConfiguredV137()]);
  const [courses, enrollments, qualifications] = configured ? await Promise.all([getAcademyCoursesV137(true), getAcademyEnrollmentsV137(), getAcademyQualificationsV137()]) : [[], [], []];
  const courseById = new Map(courses.map((course) => [course.id, course]));
  return (
    <DashboardShell allowedRoles={["manager", "commissioner"]}>
      <DashboardHeader title="Nostra Racing Academy" description="Crée les formations, traite les inscriptions, note les examens et délivre les qualifications." />
      {!configured ? <section className="dashboard-setup"><span className="module-status">Activation nécessaire</span><h2>Exécute le SQL V137</h2><p>Les formations et les inscriptions apparaîtront ensuite ici.</p></section> : <>
        {params.course && <div className="dashboard-feedback dashboard-feedback-success">Formation enregistrée.</div>}
        {params.enrollment && <div className="dashboard-feedback dashboard-feedback-success">Dossier mis à jour.</div>}
        {params.error && <div className="dashboard-feedback dashboard-feedback-error">{params.error === "scores" ? "Les notes minimales sont nécessaires pour valider la réussite." : params.error === "full" ? "Cette formation a atteint sa capacité maximale." : "Impossible d’enregistrer cette action."}</div>}
        <section className={styles.kpis}><article className={styles.kpi}><span>Formations actives</span><strong>{courses.filter((course) => course.active).length}</strong></article><article className={styles.kpi}><span>Nouvelles demandes</span><strong>{enrollments.filter((row) => row.status === "pending").length}</strong></article><article className={styles.kpi}><span>En formation</span><strong>{enrollments.filter((row) => ["accepted", "training"].includes(row.status)).length}</strong></article><article className={styles.kpi}><span>Qualifications délivrées</span><strong>{qualifications.filter((row) => row.active).length}</strong></article></section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Créer une formation</h2><p>Les seuils théorie et pratique déterminent automatiquement la réussite.</p></div></div>
          <CourseForm />
        </section>

        <section className={styles.section}>
          <div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">PROGRAMME</p><h2>Formations configurées</h2></div>
          <div className={styles.stack}>{courses.length === 0 && <article className={styles.panel}><p className={styles.empty}>Aucune formation.</p></article>}{courses.map((course) => <details className={styles.panel} key={course.id}><summary><strong>{course.title}</strong> · {course.active ? "Visible" : "Masquée"}</summary><p className={styles.notice}>{course.description}</p><CourseForm course={course} /></details>)}</div>
        </section>

        <section className={styles.section}>
          <div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">DOSSIERS PILOTES</p><h2>Inscriptions et évaluations</h2></div>
          <div className={styles.stack}>{enrollments.length === 0 && <article className={styles.panel}><p className={styles.empty}>Aucune inscription.</p></article>}{enrollments.map((row) => { const course = courseById.get(row.courseId); return <article className={styles.panel} key={row.id}><div className={styles.caseHead}><div><span className={styles.badge}>{statusLabels[row.status] ?? row.status}</span><h2>{row.applicantName}</h2><p>{course?.title ?? "Formation supprimée"} · demande du {new Date(row.appliedAt).toLocaleDateString("fr-FR")}</p></div>{row.status === "passed" && <strong>QUALIFIÉ</strong>}</div>{row.motivation && <p className={styles.notice}><strong>Motivation :</strong> {row.motivation}</p>}<form action={reviewAcademyEnrollmentV137} className={styles.form}><input type="hidden" name="enrollment_id" value={row.id} /><label>Statut<select name="status" defaultValue={row.status}><option value="pending">Nouvelle demande</option><option value="accepted">Acceptée</option><option value="training">En formation</option><option value="passed">Réussie</option><option value="failed">Échouée</option><option value="cancelled">Annulée</option></select></label><label>Note théorie /100<input name="theory_score" type="number" min="0" max="100" step="0.01" defaultValue={row.theoryScore ?? ""} /></label><label>Note pratique /100<input name="practical_score" type="number" min="0" max="100" step="0.01" defaultValue={row.practicalScore ?? ""} /></label><label>Instructeur<input name="instructor_name" defaultValue={row.instructorName ?? ""} /></label><label className={styles.span4}>Compte rendu visible par le pilote<textarea name="staff_note" rows={3} defaultValue={row.staffNote ?? ""} /></label><button className={styles.primary}>Enregistrer l’évaluation</button></form></article>; })}</div>
        </section>
      </>}
    </DashboardShell>
  );
}

function CourseForm({ course }: { course?: Awaited<ReturnType<typeof getAcademyCoursesV137>>[number] }) {
  return <form action={saveAcademyCourseV137} className={styles.form}>{course && <input type="hidden" name="course_id" value={course.id} />}<label className={styles.span2}>Nom de la formation<input name="title" defaultValue={course?.title ?? ""} required /></label><label>Durée<input name="duration_label" defaultValue={course?.durationLabel ?? ""} placeholder="Ex. 2 séances" required /></label><label>Places<input name="max_participants" type="number" min="1" defaultValue={course?.maxParticipants ?? 10} required /></label><label className={styles.span4}>Présentation<textarea name="description" rows={3} defaultValue={course?.description ?? ""} required /></label><label className={styles.span2}>Qualification délivrée<input name="qualification_label" defaultValue={course?.qualificationLabel ?? ""} placeholder="Ex. Qualification pilote GT" required /></label><label>Seuil théorie<input name="theory_pass_score" type="number" min="0" max="100" defaultValue={course?.theoryPassScore ?? 70} required /></label><label>Seuil pratique<input name="practical_pass_score" type="number" min="0" max="100" defaultValue={course?.practicalPassScore ?? 70} required /></label><label>Affichage<select name="active" defaultValue={course?.active === false ? "false" : "true"}><option value="true">Visible et inscriptions ouvertes</option><option value="false">Masquée et fermée</option></select></label><label>Ordre<input name="sort_order" type="number" defaultValue={course?.sortOrder ?? 0} /></label><button className={styles.primary}>{course ? "Enregistrer les modifications" : "Créer la formation"}</button></form>;
}
