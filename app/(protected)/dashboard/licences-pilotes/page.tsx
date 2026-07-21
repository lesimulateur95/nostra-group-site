import Link from "next/link";
import { redirect } from "next/navigation";

import { reviewPilotLicenseApplication } from "@/app/actions/licenses";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import {
  getPilotLicenseApplications,
  type PilotLicenseApplicationStatus,
} from "@/lib/licenses/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function dateTime(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: PilotLicenseApplicationStatus): string {
  if (status === "under_review") return "À examiner";
  if (status === "approved") return "Acceptée";
  if (status === "rejected") return "Refusée";
  if (status === "new_certificate_requested") {
    return "Nouveau certificat demandé";
  }
  return "Annulée";
}

export default async function PilotLicensesDashboardPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");

  const roles = await getUserRoleKeys(authData.user);

  if (!roles.includes("manager")) {
    redirect("/accueil");
  }

  const [applications, params] = await Promise.all([
    getPilotLicenseApplications(),
    searchParams,
  ]);

  const pending = applications.filter(
    (application) => application.status === "under_review",
  ).length;

  const successMessage =
    params.success === "approved"
      ? "La demande a été acceptée. Le citoyen a reçu la décision dans sa messagerie interne."
      : params.success === "rejected"
        ? "La demande a été refusée. Le citoyen a reçu le motif dans sa messagerie interne."
        : params.success === "certificate"
          ? "La demande d’un nouveau certificat a été envoyée au citoyen."
          : null;

  const errorMessage =
    params.error === "note"
      ? "Un motif est obligatoire pour refuser une demande ou réclamer un nouveau certificat."
      : params.error
        ? "La décision n’a pas pu être enregistrée."
        : null;

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            DIRECTION · NOSTRA CIRCUIT
          </span>
          <h1>Demandes de licences pilotes</h1>
          <p>
            Consulte le dossier payé, les coordonnées internes et le
            certificat médical avant de rendre ta décision.
          </p>

          <div className={styles.counters}>
            <span>
              <strong>{pending}</strong> à examiner
            </span>
            <span>
              <strong>{applications.length}</strong> dossier(s)
            </span>
          </div>
        </section>

        {successMessage && (
          <div className={styles.success}>{successMessage}</div>
        )}

        {errorMessage && (
          <div className={styles.error}>{errorMessage}</div>
        )}

        {applications.length === 0 && (
          <div className={styles.empty}>
            Aucune demande de licence pilote n’a encore été payée.
          </div>
        )}

        <section className={styles.list}>
          {applications.map((application) => (
            <article
              className={styles.card}
              key={application.id}
            >
              <header className={styles.cardHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    {application.application_number}
                  </span>
                  <h2>{application.applicant_name}</h2>
                  <p>
                    {application.license_label} ·{" "}
                    {money(application.amount)}
                  </p>
                </div>

                <span
                  className={`${styles.status} ${
                    styles[
                      `status_${application.status}` as keyof typeof styles
                    ] ?? ""
                  }`}
                >
                  {statusLabel(application.status)}
                </span>
              </header>

              <div className={styles.details}>
                <div>
                  <span>MESSAGERIE INTERNE</span>
                  <strong>{application.email}</strong>
                </div>

                <div>
                  <span>TÉLÉPHONE</span>
                  <strong>{application.phone}</strong>
                </div>

                <div>
                  <span>PAIEMENT</span>
                  <strong>{dateTime(application.paid_at)}</strong>
                </div>

                <div>
                  <span>CERTIFICAT</span>
                  {application.certificateUrl ? (
                    <a
                      href={application.certificateUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {application.medical_certificate_name} ↗
                    </a>
                  ) : (
                    <strong>Fichier indisponible</strong>
                  )}
                </div>
              </div>

              {application.review_note && (
                <div className={styles.previousNote}>
                  <span>DERNIER MESSAGE DE LA DIRECTION</span>
                  <p>{application.review_note}</p>
                </div>
              )}

              {application.certificate_replaced_at && (
                <div className={styles.replaced}>
                  Nouveau certificat déposé le{" "}
                  {dateTime(application.certificate_replaced_at)}.
                </div>
              )}

              {application.status === "under_review" && (
                <form
                  action={reviewPilotLicenseApplication}
                  className={styles.reviewForm}
                >
                  <input
                    type="hidden"
                    name="application_id"
                    value={application.id}
                  />

                  <label>
                    <span>Message ou motif transmis au citoyen</span>
                    <textarea
                      name="review_note"
                      rows={4}
                      maxLength={2000}
                      placeholder="Facultatif pour une acceptation. Obligatoire pour un refus ou une demande de nouveau certificat."
                    />
                  </label>

                  <div className={styles.actions}>
                    <button
                      className={styles.approve}
                      type="submit"
                      name="decision"
                      value="approved"
                    >
                      Accepter la licence
                    </button>

                    <button
                      className={styles.certificate}
                      type="submit"
                      name="decision"
                      value="new_certificate_requested"
                    >
                      Demander un nouveau certificat
                    </button>

                    <button
                      className={styles.reject}
                      type="submit"
                      name="decision"
                      value="rejected"
                    >
                      Refuser la licence
                    </button>
                  </div>
                </form>
              )}

              {application.status ===
                "new_certificate_requested" && (
                <div className={styles.waiting}>
                  Le dossier est en attente du nouveau certificat médical
                  du citoyen.
                </div>
              )}

              {application.document_id && (
                <footer className={styles.cardFooter}>
                  <Link
                    href={`/profil/documents/${application.document_id}`}
                  >
                    Référence du document : #{application.document_id}
                  </Link>
                </footer>
              )}
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
