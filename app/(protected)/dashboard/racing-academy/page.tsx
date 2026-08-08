import Link from "next/link";
import {
  saveAcademyCourseV137,
  saveAcademyLicenseRequirementV140,
} from "@/app/actions/racing-academy";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getPilotLicenseTypes, type PilotLicenseType } from "@/lib/licenses/data";
import {
  getAcademyConfiguredV137,
  getAcademyCoursesV137,
  getAcademyEnrollmentsV137,
  getAcademyQualificationsV137,
  type AcademyCourseV137,
} from "@/lib/racing-academy/data";
import {
  getAcademyLicenseRequirementsV140,
  type AcademyLicenseRequirementV140,
} from "@/lib/racing-academy/license-requirements";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isQualificationUsable(active: boolean, validUntil: string | null): boolean {
  if (!active) return false;
  if (!validUntil) return true;
  return validUntil.slice(0, 10) >= new Date().toISOString().slice(0, 10);
}

function validityText(days: number | null): string {
  if (!days || days <= 0) return "Permanente";
  if (days === 1) return "1 jour";
  return `${days} jours`;
}

export default async function AcademyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, configured] = await Promise.all([
    searchParams,
    getAcademyConfiguredV137(),
  ]);

  const [courses, enrollments, qualifications, licenseTypes, requirements] = configured
    ? await Promise.all([
        getAcademyCoursesV137(true),
        getAcademyEnrollmentsV137(),
        getAcademyQualificationsV137(),
        getPilotLicenseTypes(),
        getAcademyLicenseRequirementsV140(),
      ])
    : [[], [], [], [], []];

  const requirementByCode = new Map(
    requirements.map((requirement) => [requirement.licenseCode, requirement]),
  );
  const usableQualifications = qualifications.filter((row) =>
    isQualificationUsable(row.active, row.validUntil),
  );

  return (
    <DashboardShell allowedRoles={["manager", "commissioner"]}>
      <DashboardHeader
        title="Nostra Racing Academy"
        description="Formations, examens, qualifications et progression obligatoire avant chaque niveau de licence."
      />

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Exécute le SQL V137</h2>
          <p>Les formations et les inscriptions apparaîtront ensuite ici.</p>
        </section>
      ) : (
        <>
          {params.course && (
            <div className="dashboard-feedback dashboard-feedback-success">
              Formation enregistrée.
            </div>
          )}
          {params.enrollment && (
            <div className="dashboard-feedback dashboard-feedback-success">
              Dossier mis à jour.
            </div>
          )}
          {params.requirement && (
            <div className="dashboard-feedback dashboard-feedback-success">
              Prérequis de licence enregistrés.
            </div>
          )}
          {params.error && (
            <div className="dashboard-feedback dashboard-feedback-error">
              {params.error === "scores"
                ? "Les notes minimales sont nécessaires pour valider la réussite."
                : params.error === "quiz-required"
                  ? "Impossible de valider cette formation : le questionnaire théorique actif n’a pas encore été réussi."
                : params.error === "full"
                  ? "Cette formation a atteint sa capacité maximale."
                  : params.error?.startsWith("requirement")
                    ? "Impossible d’enregistrer les prérequis de cette licence."
                    : "Impossible d’enregistrer cette action."}
            </div>
          )}

          <section className={styles.kpis}>
            <article className={styles.kpi}>
              <span>Formations actives</span>
              <strong>{courses.filter((course) => course.active).length}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Nouvelles demandes</span>
              <strong>{enrollments.filter((row) => row.status === "pending").length}</strong>
            </article>
            <article className={styles.kpi}>
              <span>En formation</span>
              <strong>{enrollments.filter((row) => ["accepted", "training"].includes(row.status)).length}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Qualifications valides</span>
              <strong>{usableQualifications.length}</strong>
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.badge}>NOUVEAU · V143</span>
                <h2>Questionnaires théoriques Academy</h2>
                <p>Crée un QCM différent pour chaque formation, règle le chrono, le nombre de tentatives, le seuil de réussite et les corrections.</p>
              </div>
              <Link href="/dashboard/racing-academy/questionnaires" className={styles.primary}>Gérer les questionnaires</Link>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Progression Academy → licences</h2>
                <p>
                  Configure précisément la formation, la licence préalable, les notes minimales et la durée de chaque licence.
                </p>
              </div>
            </div>

            {licenseTypes.length > 0 && requirements.length === 0 ? (
              <div className="dashboard-feedback dashboard-feedback-error">
                Le module V140 n’est pas encore activé. Exécute le SQL V140 pour créer la matrice des prérequis.
              </div>
            ) : null}

            <div className={styles.stack}>
              {licenseTypes.map((license) => (
                <RequirementForm
                  key={license.code}
                  license={license}
                  requirement={requirementByCode.get(license.code)}
                  courses={courses}
                  licenseTypes={licenseTypes}
                />
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Créer une formation</h2>
                <p>
                  Les seuils théorie et pratique déterminent automatiquement la réussite. La qualification peut être permanente ou expirer.
                </p>
              </div>
            </div>
            <CourseForm />
          </section>

          <section className={styles.section}>
            <div className="dashboard-section-heading dashboard-section-heading-tight">
              <p className="eyebrow">PROGRAMME</p>
              <h2>Formations configurées</h2>
            </div>
            <div className={styles.stack}>
              {courses.length === 0 && (
                <article className={styles.panel}>
                  <p className={styles.empty}>Aucune formation.</p>
                </article>
              )}
              {courses.map((course) => (
                <details className={styles.panel} key={course.id}>
                  <summary>
                    <strong>{course.title}</strong> · {course.active ? "Visible" : "Masquée"} · Qualification {validityText(course.qualificationValidDays)}
                  </summary>
                  <p className={styles.notice}>{course.description}</p>
                  <CourseForm course={course} />
                </details>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.badge}>RÉGIE FORMATION · V147</span>
                <h2>Participants, questionnaires & évaluations</h2>
                <p>Accepte les candidats, envoie le questionnaire directement dans leur boîte mail Nostra, suis la correction en direct puis note la pratique et ton appréciation.</p>
              </div>
              <Link href="/dashboard/racing-academy/evaluations" className={styles.primary}>Ouvrir les participants & évaluations</Link>
            </div>
            <div className={styles.detailsGrid}>
              <div><span>Dossiers</span><strong>{enrollments.length}</strong></div>
              <div><span>Nouvelles demandes</span><strong>{enrollments.filter((row) => row.status === "pending").length}</strong></div>
              <div><span>En formation</span><strong>{enrollments.filter((row) => ["accepted", "training"].includes(row.status)).length}</strong></div>
              <div><span>Terminés</span><strong>{enrollments.filter((row) => ["passed", "failed"].includes(row.status)).length}</strong></div>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}

function RequirementForm({
  license,
  requirement,
  courses,
  licenseTypes,
}: {
  license: PilotLicenseType;
  requirement?: AcademyLicenseRequirementV140;
  courses: AcademyCourseV137[];
  licenseTypes: PilotLicenseType[];
}) {
  return (
    <details className={styles.panel} open={Boolean(requirement?.requiredCourseId)}>
      <summary>
        <strong>{license.label}</strong> · {requirement?.requiredCourseId ? "Formation dédiée" : "Toute qualification Academy"}
        {requirement?.prerequisiteLicenseCode ? ` · prérequis ${requirement.prerequisiteLicenseCode}` : ""}
      </summary>
      <form action={saveAcademyLicenseRequirementV140} className={styles.form}>
        <input type="hidden" name="license_code" value={license.code} />
        <input type="hidden" name="license_label" value={license.label} />

        <label className={styles.span2}>
          Formation Academy obligatoire
          <select name="required_course_id" defaultValue={requirement?.requiredCourseId ?? ""}>
            <option value="">Toute qualification Academy valide</option>
            {courses.map((course) => (
              <option value={course.id} key={course.id}>
                {course.title} {!course.active ? "(masquée)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          Licence préalable
          <select name="prerequisite_license_code" defaultValue={requirement?.prerequisiteLicenseCode ?? ""}>
            <option value="">Aucune</option>
            {licenseTypes
              .filter((type) => type.code !== license.code)
              .map((type) => (
                <option value={type.code} key={type.code}>
                  {type.label}
                </option>
              ))}
          </select>
        </label>

        <label>
          Validité de la licence (mois)
          <input
            name="license_validity_months"
            type="number"
            min="1"
            max="60"
            defaultValue={requirement?.licenseValidityMonths ?? 5}
            required
          />
        </label>

        <label>
          Note théorie minimale
          <input name="min_theory_score" type="number" min="0" max="100" step="0.01" defaultValue={requirement?.minTheoryScore ?? 0} />
        </label>
        <label>
          Note pratique minimale
          <input name="min_practical_score" type="number" min="0" max="100" step="0.01" defaultValue={requirement?.minPracticalScore ?? 0} />
        </label>
        <label>
          Règle active
          <select name="active" defaultValue={requirement?.active === false ? "false" : "true"}>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </label>
        <button className={styles.primary}>Enregistrer les prérequis</button>
      </form>
    </details>
  );
}

function CourseForm({ course }: { course?: AcademyCourseV137 }) {
  return (
    <form action={saveAcademyCourseV137} className={styles.form}>
      {course && <input type="hidden" name="course_id" value={course.id} />}
      <label className={styles.span2}>
        Nom de la formation
        <input name="title" defaultValue={course?.title ?? ""} required />
      </label>
      <label>
        Durée
        <input name="duration_label" defaultValue={course?.durationLabel ?? ""} placeholder="Ex. 2 séances" required />
      </label>
      <label>
        Places
        <input name="max_participants" type="number" min="1" defaultValue={course?.maxParticipants ?? 10} required />
      </label>
      <label className={styles.span4}>
        Présentation
        <textarea name="description" rows={3} defaultValue={course?.description ?? ""} required />
      </label>
      <label className={styles.span2}>
        Qualification délivrée
        <input name="qualification_label" defaultValue={course?.qualificationLabel ?? ""} placeholder="Ex. Qualification pilote GT" required />
      </label>
      <label>
        Seuil théorie
        <input name="theory_pass_score" type="number" min="0" max="100" defaultValue={course?.theoryPassScore ?? 70} required />
      </label>
      <label>
        Seuil pratique
        <input name="practical_pass_score" type="number" min="0" max="100" defaultValue={course?.practicalPassScore ?? 70} required />
      </label>
      <label>
        Validité qualification (jours)
        <input name="qualification_valid_days" type="number" min="0" max="3650" defaultValue={course?.qualificationValidDays ?? 0} />
        <small>0 = qualification permanente. Exemple : 180 pour 6 mois environ.</small>
      </label>
      <label>
        Affichage
        <select name="active" defaultValue={course?.active === false ? "false" : "true"}>
          <option value="true">Visible et inscriptions ouvertes</option>
          <option value="false">Masquée et fermée</option>
        </select>
      </label>
      <label>
        Ordre
        <input name="sort_order" type="number" defaultValue={course?.sortOrder ?? 0} />
      </label>
      <button className={styles.primary}>{course ? "Enregistrer les modifications" : "Créer la formation"}</button>
    </form>
  );
}
