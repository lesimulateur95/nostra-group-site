import Link from "next/link";
import { redirect } from "next/navigation";

import { submitRecruitmentApplication } from "@/app/actions/recruitment";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { formatParisDateTime } from "@/lib/dates/paris";
import { getOwnRecruitmentApplications } from "@/lib/recruitment/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  new: "Nouvelle candidature",
  reviewing: "En cours d’étude",
  interview: "Entretien prévu",
  accepted: "Acceptée",
  refused: "Refusée",
  archived: "Archivée",
};

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const [params, applications] = await Promise.all([
    searchParams,
    getOwnRecruitmentApplications(data.user.id),
  ]);
  const metadata = data.user.user_metadata ?? {};

  return (
    <>
      <div className={styles.backHomeWrap}>
        <Link className={styles.backHome} href="/accueil">
          <span aria-hidden="true">←</span>
          Retour à l’accueil
        </Link>
      </div>

      <section className="profile-heading">
        <span className="eyebrow">NOSTRA GROUP</span>
        <h1 className="page-title">Recrutement</h1>
        <p className="lead">
          Dépose ta candidature et suis son traitement directement depuis le
          site.
        </p>
      </section>

      {params.sent && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Candidature <strong>{params.sent}</strong> envoyée à la direction.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "already-active"
            ? "Tu as déjà une candidature active. Attends son traitement avant d’en envoyer une nouvelle."
            : params.error === "setup"
              ? "Le service de recrutement est momentanément indisponible. Réessaie dans quelques instants."
              : "Vérifie les informations du formulaire puis réessaie."}
        </div>
      )}

      <div className="recruitment-layout-v96">
          <section className="backoffice-panel">
            <div className="dashboard-section-heading dashboard-section-heading-tight">
              <p className="eyebrow">CANDIDATURE</p>
              <h2>Rejoindre Nostra Group</h2>
              <p>
                Remplis le formulaire avec des réponses précises. La direction
                pourra ensuite te proposer un entretien, accepter ou refuser ta
                candidature.
              </p>
            </div>

            <form action={submitRecruitmentApplication} className="backoffice-form">
              <label>
                Nom RP
                <input
                  name="candidate_name"
                  defaultValue={getRpName(data.user) || ""}
                  required
                />
              </label>
              <label>
                Nom Discord
                <input
                  name="discord_name"
                  defaultValue={getDiscordName(data.user) || ""}
                />
              </label>
              <label>
                Téléphone
                <input
                  name="phone"
                  defaultValue={
                    typeof metadata.phone === "string" ? metadata.phone : ""
                  }
                />
              </label>
              <label>
                Poste souhaité
                <select name="position" required defaultValue="">
                  <option value="" disabled>
                    Choisir un poste
                  </option>
                  <option value="Commercial Nostra Motors">
                    Commercial Nostra Motors
                  </option>
                  <option value="Employé Nostra Motors">
                    Employé Nostra Motors
                  </option>
                  <option value="Commissaire de course">
                    Commissaire de course
                  </option>
                  <option value="Autre poste Nostra Group">
                    Autre poste Nostra Group
                  </option>
                </select>
              </label>
              <label className="form-span-2">
                Disponibilités et présence sur l’île
                <textarea
                  name="availability"
                  rows={3}
                  required
                  placeholder="Jours, horaires et fréquence de présence..."
                />
              </label>
              <label className="form-span-2">
                Motivation
                <textarea
                  name="motivation"
                  rows={6}
                  required
                  minLength={20}
                  placeholder="Pourquoi souhaites-tu rejoindre Nostra Group ?"
                />
              </label>
              <label className="form-span-2">
                Expérience
                <textarea
                  name="experience"
                  rows={4}
                  placeholder="Expériences professionnelles ou RP utiles au poste..."
                />
              </label>
              <label className="form-span-2">
                Qualités et points forts
                <textarea
                  name="strengths"
                  rows={4}
                  placeholder="Relation client, travail en équipe, polyvalence..."
                />
              </label>
              <button type="submit" className="btn form-span-2">
                Envoyer ma candidature
              </button>
            </form>
          </section>

          <section className="backoffice-panel">
            <div className="dashboard-section-heading dashboard-section-heading-tight">
              <p className="eyebrow">SUIVI</p>
              <h2>Mes candidatures</h2>
            </div>

            <div className="recruitment-own-list-v96">
              {applications.length === 0 && (
                <p className="empty-state">Aucune candidature envoyée.</p>
              )}
              {applications.map((application) => (
                <article key={application.id} className="recruitment-own-card-v96">
                  <div>
                    <span className={`request-status recruitment-status-${application.status}`}>
                      {statusLabels[application.status] ?? application.status}
                    </span>
                    <h3>{application.application_number}</h3>
                    <p>{application.position}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Envoyée le</dt>
                      <dd>
                        {formatParisDateTime(application.created_at)}
                      </dd>
                    </div>
                    <div>
                      <dt>Responsable</dt>
                      <dd>{application.assigned_to || "Non attribué"}</dd>
                    </div>
                    {application.interview_at && (
                      <div>
                        <dt>Entretien</dt>
                        <dd>
                          {formatParisDateTime(application.interview_at)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {application.manager_response && (
                    <div className="reservation-reason">
                      <span>Réponse de la direction</span>
                      <p>{application.manager_response}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
    </>
  );
}
