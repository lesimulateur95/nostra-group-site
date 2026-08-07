import Link from "next/link";
import { redirect } from "next/navigation";

import { getPilotLicenseTypes } from "@/lib/licenses/data";
import { getOwnOfficialPilotLicences } from "@/lib/licenses/lifecycle";
import {
  getAcademyCoursesV137,
  getAcademyEnrollmentsV137,
  getAcademyQualificationsV137,
} from "@/lib/racing-academy/data";
import { getAcademyLicenseEligibilitiesV140 } from "@/lib/racing-academy/license-requirements";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null): string {
  if (!value) return "Sans expiration";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function remainingText(days: number | null): string {
  if (days === null) return "Validité en cours";
  if (days < 0) return `Expirée depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
  if (days === 0) return "Expire aujourd’hui";
  if (days === 1) return "Expire demain";
  return `${days} jours restants`;
}

function academyStatusLabel(status: string): string {
  return (
    {
      pending: "Demande envoyée",
      accepted: "Inscription acceptée",
      training: "Formation en cours",
      passed: "Formation réussie",
      failed: "Formation non validée",
      cancelled: "Inscription annulée",
    }[status] ?? status
  );
}

function eligibilityText(reason: string, course: string | null, prerequisite: string | null): string {
  if (reason === "ok") return "Tous les prérequis sont remplis. Achat possible si la Direction a ouvert cette licence.";
  if (reason === "academy_training_expired") return "La qualification nécessaire a expiré : la formation doit être renouvelée.";
  if (reason === "license_revoked") return "Cette licence a été retirée par la Direction : réactivation administrative obligatoire.";
  if (reason === "license_suspended") return "Cette licence est suspendue : achat et renouvellement bloqués pendant la sanction.";
  if (reason === "prerequisite_license_required") return `Licence préalable manquante, expirée ou suspendue${prerequisite ? ` : ${prerequisite}` : ""}.`;
  if (reason === "academy_specific_training_required") return `Formation Academy à valider${course ? ` : ${course}` : ""}.`;
  if (reason === "academy_requirement_disabled") return "Parcours temporairement désactivé par la Direction.";
  if (reason === "setup") return "Le module de progression V140 doit être activé.";
  return "Une qualification Academy valide est nécessaire.";
}

export default async function MyLicencesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const licenseTypes = await getPilotLicenseTypes();
  const [licences, courses, enrollments, qualifications, eligibilityByCode] = await Promise.all([
    getOwnOfficialPilotLicences(data.user.id),
    getAcademyCoursesV137(true),
    getAcademyEnrollmentsV137(data.user.id),
    getAcademyQualificationsV137(data.user.id),
    getAcademyLicenseEligibilitiesV140(
      data.user.id,
      licenseTypes.map((license) => license.code),
    ),
  ]);

  const scheduledNames = new Set(
    licences
      .filter((licence) => licence.lifecycle.status === "upcoming")
      .map((licence) => licence.licence_name.trim().toLowerCase()),
  );
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const today = new Date().toISOString().slice(0, 10);
  const ownedLicenseCodes = new Set(
    licences
      .filter((licence) =>
        ["active", "expiring_soon", "upcoming"].includes(licence.lifecycle.status),
      )
      .map((licence) => licence.renewalLicenseCode)
      .filter((code): code is string => Boolean(code)),
  );

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/profil">← Retour au profil</Link>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/circuit/racing-academy">
            Racing Academy
          </Link>
          <Link className="btn btn-secondary" href="/profil/discipline">
            Dossier disciplinaire
          </Link>
          <Link className="btn btn-secondary" href="/circuit/administration-sportive/payer-ma-licence">
            Demander une licence
          </Link>
        </div>
      </div>

      <header className={styles.hero}>
        <span>ESPACE PILOTE · ACADEMY</span>
        <h1>Mes licences &amp; formations</h1>
        <p>
          Suis ton parcours Nostra Racing Academy, les qualifications obtenues, les prérequis de chaque niveau, la validité de tes licences et les éventuelles suspensions.
        </p>
      </header>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <span>PROGRESSION</span>
            <h2>Mon parcours vers les licences</h2>
          </div>
          <small>{licenseTypes.length} niveau(x) configuré(s)</small>
        </div>
        <div className={styles.progressGrid}>
          {licenseTypes.map((license, index) => {
            const eligibility = eligibilityByCode.get(license.code);
            const eligible = eligibility?.eligible === true;
            const owned = ownedLicenseCodes.has(license.code);
            return (
              <article className={`${styles.progressCard} ${owned || eligible ? styles.progressOk : styles.progressLocked}`} key={license.code}>
                <div className={styles.progressTop}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span className={styles.progressBadge}>
                    {owned ? "LICENCE OBTENUE" : eligible ? "DÉBLOQUÉ" : "VERROUILLÉ"}
                  </span>
                </div>
                <h3>{license.label}</h3>
                <p>
                  {owned
                    ? "Cette licence officielle est bien reconnue par la Racing Academy et compte pour les prérequis du niveau suivant."
                    : eligibility
                      ? eligibilityText(
                          eligibility.reason,
                          eligibility.requiredCourseTitle,
                          eligibility.prerequisiteLicenseLabel,
                        )
                      : "Contrôle Academy indisponible."}
                </p>
                {eligibility?.requiredCourseTitle ? (
                  <small>Formation : {eligibility.requiredCourseTitle}</small>
                ) : null}
                {eligibility?.prerequisiteLicenseLabel ? (
                  <small>Licence préalable : {eligibility.prerequisiteLicenseLabel}</small>
                ) : null}
                {eligibility ? (
                  <small>Licence valable {eligibility.licenseValidityMonths} mois après délivrance.</small>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <span>NOSTRA RACING ACADEMY</span>
            <h2>Mes qualifications</h2>
          </div>
          <small>{qualifications.length} qualification(s)</small>
        </div>
        {qualifications.length === 0 ? (
          <div className={styles.emptyInline}>Aucune qualification Academy délivrée pour le moment.</div>
        ) : (
          <div className={styles.grid}>
            {qualifications.map((qualification) => {
              const expired = Boolean(qualification.validUntil && qualification.validUntil.slice(0, 10) < today);
              const usable = qualification.active && !expired;
              return (
                <article className={styles.card} key={`qualification-${qualification.id}`}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.number}>{qualification.number}</span>
                      <h2>{qualification.label}</h2>
                    </div>
                    <span className={`${styles.status} ${usable ? styles.active : styles.expired}`}>
                      {usable ? "Valide" : expired ? "Expirée" : "Inactive"}
                    </span>
                  </div>
                  <div className={styles.dates}>
                    <div>
                      <span>Délivrée le</span>
                      <strong>{formatDate(qualification.issuedAt)}</strong>
                    </div>
                    <div>
                      <span>Valable jusqu’au</span>
                      <strong>{formatDate(qualification.validUntil)}</strong>
                    </div>
                  </div>
                  <div className={styles.remaining}>
                    Théorie {qualification.theoryScore}/100 · Pratique {qualification.practicalScore}/100
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <span>FORMATIONS</span>
            <h2>Mes dossiers Academy</h2>
          </div>
          <small>{enrollments.length} dossier(s)</small>
        </div>
        {enrollments.length === 0 ? (
          <div className={styles.emptyInline}>Aucune inscription à une formation.</div>
        ) : (
          <div className={styles.progressGrid}>
            {enrollments.map((enrollment) => (
              <article className={styles.progressCard} key={`enrollment-${enrollment.id}`}>
                <div className={styles.progressTop}>
                  <span className={styles.progressBadge}>{academyStatusLabel(enrollment.status)}</span>
                </div>
                <h3>{courseById.get(enrollment.courseId)?.title ?? `Formation #${enrollment.courseId}`}</h3>
                <p>{enrollment.staffNote ?? "Aucun commentaire de l’instructeur."}</p>
                {enrollment.theoryScore != null || enrollment.practicalScore != null ? (
                  <small>Théorie {enrollment.theoryScore ?? "—"}/100 · Pratique {enrollment.practicalScore ?? "—"}/100</small>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <span>LICENCES OFFICIELLES</span>
            <h2>Mes licences</h2>
          </div>
          <small>{licences.length} licence(s)</small>
        </div>

        {licences.length === 0 ? (
          <section className={styles.empty}>
            <strong>Aucune licence officielle pour le moment</strong>
            <p>Une licence apparaîtra ici dès que la Direction du Nostra Circuit aura validé ta demande.</p>
            <Link className="btn btn-primary" href="/circuit/administration-sportive/payer-ma-licence">
              Faire une demande
            </Link>
          </section>
        ) : (
          <section className={styles.grid}>
            {licences.map((licence) => {
              const hasScheduledRenewal =
                licence.lifecycle.status !== "upcoming" &&
                scheduledNames.has(licence.licence_name.trim().toLowerCase());
              const canRenew =
                licence.lifecycle.canRenew &&
                !hasScheduledRenewal &&
                Boolean(licence.renewalLicenseCode);
              const administrativeSuspension =
                licence.administrative.state === "suspended" &&
                (!licence.administrative.suspendedUntil || licence.administrative.suspendedUntil >= today);

              return (
                <article className={styles.card} key={licence.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.number}>{licence.licence_number}</span>
                      <h2>{licence.licence_name}</h2>
                    </div>
                    <span
                      className={`${styles.status} ${styles[licence.lifecycle.status] ?? ""}`}
                      style={
                        licence.lifecycle.status === "suspended" || licence.lifecycle.status === "revoked"
                          ? {
                              color: "#ff9d9d",
                              borderColor: "rgba(226,74,74,.45)",
                              background: "rgba(226,74,74,.1)",
                            }
                          : undefined
                      }
                    >
                      {licence.lifecycle.label}
                    </span>
                  </div>

                  <div className={styles.dates}>
                    <div>
                      <span>Début de validité</span>
                      <strong>{formatDate(licence.valid_from)}</strong>
                    </div>
                    <div>
                      <span>Date d’expiration</span>
                      <strong>{formatDate(licence.valid_until)}</strong>
                    </div>
                  </div>

                  <div className={styles.remaining}>
                    {licence.lifecycle.status === "revoked"
                      ? "Licence retirée par la Direction"
                      : administrativeSuspension
                        ? `Suspension administrative${licence.administrative.suspendedUntil ? ` jusqu’au ${formatDate(licence.administrative.suspendedUntil)}` : ""}`
                        : licence.lifecycle.status === "suspended"
                          ? `Suspendue jusqu’au ${formatDate(licence.discipline.suspensionEndsOn)}`
                          : remainingText(licence.lifecycle.daysRemaining)}
                  </div>

                  {licence.administrative.reason ? (
                    <div className={styles.alertBox}>
                      <strong>Décision administrative</strong>
                      <p>{licence.administrative.reason}</p>
                    </div>
                  ) : null}

                  <div className={styles.remaining}>
                    Solde disciplinaire : {licence.discipline.pointsRemaining}/12 points
                  </div>

                  {hasScheduledRenewal ? (
                    <p className={styles.scheduledNotice}>Un renouvellement est déjà programmé pour cette licence.</p>
                  ) : null}

                  <div className={styles.actions}>
                    <Link className="btn btn-secondary" href={`/profil/licences/${licence.id}`}>
                      Voir la licence
                    </Link>
                    {canRenew ? (
                      <Link className="btn btn-primary" href="/circuit/administration-sportive/payer-ma-licence">
                        Renouveler
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>

      <section className={styles.info}>
        <strong>Progression et renouvellement</strong>
        <p>
          Une licence supérieure peut exiger une formation précise et une licence inférieure valide. Une licence expirée, suspendue ou retirée ne compte plus comme prérequis. Les durées sont configurées directement par la Direction dans la Racing Academy.
        </p>
      </section>
    </main>
  );
}
