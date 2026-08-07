import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getPilotLicenseTypes } from "@/lib/licenses/data";
import { getAcademyCoursesV137, getAcademyEnrollmentsV137, getAcademyQualificationsV137 } from "@/lib/racing-academy/data";
import { getAcademyLicenseEligibilitiesV140 } from "@/lib/racing-academy/license-requirements";
import { createClient } from "@/lib/supabase/server";
import {
  citizenDetail,
  type JsonRow,
} from "@/lib/operations-v50/data";

import styles from "@/components/operations-v50/operations.module.css";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.map(String).join(" · ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }

  return String(value);
}

function rows(value: unknown): JsonRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRow =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

function recordTitle(record: JsonRow): string {
  return String(
    record.order_number ??
      record.ticket_number ??
      record.application_number ??
      record.document_title ??
      record.subject ??
      record.id ??
      "Enregistrement",
  );
}

function Records({
  name,
  value,
}: {
  name: string;
  value: unknown;
}) {
  const list = rows(value);

  return (
    <section className={styles.section}>
      <header>
        <span>HISTORIQUE</span>
        <h2>
          {name} · {list.length}
        </h2>
      </header>

      {list.length > 0 ? (
        <div className={styles.recordGrid}>
          {list.map((record, index) => (
            <article
              className={styles.record}
              key={`${recordTitle(record)}-${index}`}
            >
              <strong>{recordTitle(record)}</strong>
              <small>
                {text(
                  record.status ??
                    record.created_at ??
                    record.total,
                )}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          Aucun élément.
        </div>
      )}
    </section>
  );
}

export default async function CitizenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    detail,
    academyCourses,
    academyEnrollments,
    academyQualifications,
    licenseTypes,
    officialLicencesResult,
    academyLinksResult,
  ] = await Promise.all([
    citizenDetail(id),
    getAcademyCoursesV137(true),
    getAcademyEnrollmentsV137(id),
    getAcademyQualificationsV137(id),
    getPilotLicenseTypes(),
    (supabase as any)
      .from("nostra_licences")
      .select("id,licence_number,licence_name,status,valid_from,valid_until")
      .eq("holder_user_id", id),
    (supabase as any)
      .from("academy_generated_licence_links_v142")
      .select("licence_id,license_code")
      .eq("holder_user_id", id),
  ]);

  const academyEligibilityByCode = await getAcademyLicenseEligibilitiesV140(
    id,
    licenseTypes.map((license) => license.code),
  );

  if (!detail) {
    notFound();
  }

  const profile = (detail.profile ?? {}) as JsonRow;
  const loyalty =
    detail.loyalty && typeof detail.loyalty === "object"
      ? (detail.loyalty as JsonRow)
      : null;

  const today = new Date().toISOString().slice(0, 10);
  const activeAcademyQualifications = academyQualifications.filter(
    (row) => row.active && (!row.validUntil || row.validUntil.slice(0, 10) >= today),
  );
  const academyCourseById = new Map(academyCourses.map((course) => [course.id, course]));
  const academyStatusLabels: Record<string, string> = {
    pending: "Demande en attente",
    accepted: "Inscription acceptée",
    training: "En formation",
    passed: "Formation validée",
    failed: "Formation échouée",
    cancelled: "Formation annulée",
  };

  const officialLicences = !officialLicencesResult.error && Array.isArray(officialLicencesResult.data)
    ? (officialLicencesResult.data as Array<{
        id: string;
        licence_number: string;
        licence_name: string;
        status: string;
        valid_from: string;
        valid_until: string | null;
      }>)
    : [];
  const academyLinks = !academyLinksResult.error && Array.isArray(academyLinksResult.data)
    ? (academyLinksResult.data as Array<{ licence_id: string; license_code: string }>)
    : [];
  const academyCodeByLicenceId = new Map(academyLinks.map((link) => [String(link.licence_id), String(link.license_code)]));
  const officialLicenceByAcademyCode = new Map<string, (typeof officialLicences)[number]>();
  for (const licence of officialLicences) {
    const code = academyCodeByLicenceId.get(String(licence.id));
    if (code && !officialLicenceByAcademyCode.has(code)) {
      officialLicenceByAcademyCode.set(code, licence);
    }
  }

  const identityRows: Array<[string, unknown]> = [
    ["Nom", profile.name],
    ["E-mail", profile.email],
    ["Téléphone", profile.phone],
    ["Adresse", profile.address],
    [
      "Rôles",
      Array.isArray(profile.roles) && profile.roles.length > 0
        ? profile.roles
        : profile.role,
    ],
    ["Fidélité", loyalty?.label],
  ];

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <span>DIRECTION · FICHE CITOYEN</span>
          <h1>{text(profile.name)}</h1>
          <p>
            Vue centralisée des informations du compte.
          </p>
          <Link
            className={styles.actionLink}
            href="/dashboard"
          >
            ← Retour au Dashboard
          </Link>
        </section>

        <section className={styles.section}>
          <header>
            <span>IDENTITÉ</span>
            <h2>Profil</h2>
          </header>

          <dl className={styles.details}>
            {identityRows.map(([label, value]) => (
              <div
                className={styles.detail}
                key={label}
              >
                <dt>{label}</dt>
                <dd>{text(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section}>
          <header>
            <span>NOSTRA RACING ACADEMY · V140</span>
            <h2>Formations &amp; accès aux licences</h2>
          </header>

          <div className={styles.recordGrid}>
            {licenseTypes.map((license) => {
              const eligibility = academyEligibilityByCode.get(license.code);
              const officialLicence = officialLicenceByAcademyCode.get(license.code);
              return (
                <article className={styles.record} key={`eligibility-${license.code}`}>
                  <strong>{license.label}</strong>
                  <small>
                    {officialLicence
                      ? `✓ LICENCE OFFICIELLE DÉLIVRÉE · ${officialLicence.licence_number}`
                      : eligibility?.eligible
                      ? "✓ ACHAT AUTORISÉ CÔTÉ ACADEMY"
                      : eligibility?.reason === "license_revoked"
                        ? "⛔ LICENCE RETIRÉE"
                        : eligibility?.reason === "license_suspended"
                          ? "⏸ LICENCE SUSPENDUE"
                          : eligibility?.reason === "academy_training_expired"
                            ? "🔒 QUALIFICATION EXPIRÉE"
                        : eligibility?.reason === "prerequisite_license_required"
                          ? `🔒 PRÉREQUIS : ${eligibility.prerequisiteLicenseLabel ?? "licence inférieure"}`
                          : eligibility?.reason === "academy_specific_training_required"
                            ? `🔒 FORMATION : ${eligibility.requiredCourseTitle ?? "formation dédiée"}`
                            : "🔒 FORMATION ACADEMY REQUISE"}
                  </small>
                </article>
              );
            })}
          </div>

          {activeAcademyQualifications.length > 0 && (
            <div className={styles.recordGrid}>
              {activeAcademyQualifications.map((qualification) => (
                <article className={styles.record} key={qualification.id}>
                  <strong>{qualification.label}</strong>
                  <small>
                    VALIDÉE · {qualification.number} · {new Date(qualification.issuedAt).toLocaleDateString("fr-FR")}
                    {qualification.validUntil ? ` · expire le ${new Date(`${qualification.validUntil.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR")}` : " · permanente"}
                  </small>
                </article>
              ))}
            </div>
          )}

          {academyQualifications.some((row) => row.validUntil && row.validUntil.slice(0, 10) < today) && (
            <div className={styles.warning}>
              <strong>Qualification(s) expirée(s)</strong>
              <p>Une formation expirée ne débloque plus l’achat des licences qui en dépendent.</p>
            </div>
          )}

          {academyEnrollments.length > 0 && (
            <div className={styles.recordGrid}>
              {academyEnrollments.map((enrollment) => (
                <article className={styles.record} key={`academy-${enrollment.id}`}>
                  <strong>{academyCourseById.get(enrollment.courseId)?.title ?? `Formation #${enrollment.courseId}`}</strong>
                  <small>{academyStatusLabels[enrollment.status] ?? enrollment.status}</small>
                </article>
              ))}
            </div>
          )}

          {academyEnrollments.length === 0 && academyQualifications.length === 0 && (
            <div className={styles.empty}>Aucune formation Academy enregistrée pour ce citoyen.</div>
          )}
        </section>

        <Records name="Commandes" value={detail.orders} />
        <Records
          name="Rendez-vous"
          value={detail.appointments}
        />
        <Records name="Licences" value={detail.licenses} />
        <Records name="Plaques" value={detail.plates} />
        <Records name="Documents" value={detail.documents} />
        <Records name="SAV" value={detail.sav} />
        <Records
          name="Candidatures"
          value={detail.recruitment}
        />
        <Records name="Journal" value={detail.audit} />
      </main>
    </DashboardShell>
  );
}
