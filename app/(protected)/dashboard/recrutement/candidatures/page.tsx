import Link from "next/link";
import { reviewRecruitmentApplication } from "@/app/actions/recruitment";
import { RecruitmentResponseCopy } from "@/components/dashboard/recruitment-response-copy";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { formatParisDateTime, toParisDateTimeLocal } from "@/lib/dates/paris";
import {
  getRecruitmentApplications,
  getRecruitmentConfigured,
  getRecruitmentHistory,
  type RecruitmentApplication,
  type RecruitmentHistoryEntry,
} from "@/lib/recruitment/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  new: "Nouvelle",
  reviewing: "En cours d’étude",
  interview: "Entretien prévu",
  accepted: "Acceptée",
  refused: "Refusée",
  archived: "Archivée",
};


export default async function RecruitmentApplicationsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, configured, applications] = await Promise.all([
    searchParams,
    getRecruitmentConfigured(),
    getRecruitmentApplications(),
  ]);
  const history = configured
    ? await getRecruitmentHistory(applications.map((item) => item.id))
    : [];
  const historyByApplication = new Map<number, RecruitmentHistoryEntry[]>();
  history.forEach((entry) => {
    const values = historyByApplication.get(entry.application_id) ?? [];
    values.push(entry);
    historyByApplication.set(entry.application_id, values);
  });

  const active = applications.filter((item) =>
    ["new", "reviewing", "interview"].includes(item.status),
  );
  const processed = applications.filter((item) => !active.includes(item));

  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader
        title="Gestion des candidatures"
        description="Étudie les candidatures, planifie les entretiens, ajoute des notes privées et prépare les réponses d’acceptation ou de refus."
      />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer le recrutement V96</h2>
          <p>
            Exécute le fichier <strong>nostra-v96-recrutement-reservations-reprise.sql</strong>{" "}
            dans Supabase.
          </p>
        </section>
      )}
      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Candidature mise à jour.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "setup"
            ? "Le SQL V96 doit être exécuté dans Supabase."
            : params.error === "interview-date"
              ? "Renseigne la date et l’heure de l’entretien avant de choisir ce statut."
              : "Impossible de modifier cette candidature."}
        </div>
      )}

      {configured && (
        <>
          <section className="reservation-admin-summary recruitment-summary-v96">
            <article>
              <span>Nouvelles</span>
              <strong>
                {applications.filter((item) => item.status === "new").length}
              </strong>
            </article>
            <article>
              <span>En étude</span>
              <strong>
                {applications.filter((item) => item.status === "reviewing").length}
              </strong>
            </article>
            <article>
              <span>Entretiens</span>
              <strong>
                {applications.filter((item) => item.status === "interview").length}
              </strong>
            </article>
            <article>
              <span>Acceptées</span>
              <strong>
                {applications.filter((item) => item.status === "accepted").length}
              </strong>
            </article>
          </section>

          <section className="orders-admin-list recruitment-admin-list-v96">
            {active.length === 0 && (
              <div className="backoffice-panel empty-state">
                Aucune candidature active.
              </div>
            )}
            {active.map((application) => (
              <RecruitmentApplicationCard
                key={application.id}
                application={application}
                history={historyByApplication.get(application.id) ?? []}
              />
            ))}
          </section>

          {processed.length > 0 && (
            <section className="processed-reservations">
              <div className="dashboard-section-heading dashboard-section-heading-tight">
                <p className="eyebrow">HISTORIQUE</p>
                <h2>Candidatures traitées</h2>
              </div>
              <div className="orders-admin-list recruitment-admin-list-v96">
                {processed.map((application) => (
                  <RecruitmentApplicationCard
                    key={application.id}
                    application={application}
                    history={historyByApplication.get(application.id) ?? []}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}

function RecruitmentApplicationCard({
  application,
  history,
}: {
  application: RecruitmentApplication;
  history: RecruitmentHistoryEntry[];
}) {
  return (
    <article className="backoffice-panel recruitment-application-card-v96">
      <div className="order-admin-head">
        <div>
          <span className={`request-status recruitment-status-${application.status}`}>
            {statusLabels[application.status] ?? application.status}
          </span>
          <h2>{application.application_number}</h2>
          <p>
            <strong>{application.candidate_name}</strong> · {application.position}
            {" · "}
            {formatParisDateTime(application.created_at)}
          </p>
        </div>
        <div className="recruitment-contact-v96">
          <strong>{application.discord_name || "Discord non renseigné"}</strong>
          <span>{application.phone || "Téléphone non renseigné"}</span>
        </div>
      </div>

      <div className="recruitment-answers-v96">
        <div>
          <span>Disponibilités</span>
          <p>{application.availability}</p>
        </div>
        <div>
          <span>Motivation</span>
          <p>{application.motivation}</p>
        </div>
        {application.experience && (
          <div>
            <span>Expérience</span>
            <p>{application.experience}</p>
          </div>
        )}
        {application.strengths && (
          <div>
            <span>Qualités et points forts</span>
            <p>{application.strengths}</p>
          </div>
        )}
      </div>

      <form action={reviewRecruitmentApplication} className="backoffice-form">
        <input type="hidden" name="application_id" value={application.id} />
        <label>
          Statut
          <select name="status" defaultValue={application.status}>
            <option value="new">Nouvelle</option>
            <option value="reviewing">En cours d’étude</option>
            <option value="interview">Entretien prévu</option>
            <option value="accepted">Acceptée</option>
            <option value="refused">Refusée</option>
            <option value="archived">Archivée</option>
          </select>
        </label>
        <label>
          Responsable du dossier
          <input
            name="assigned_to"
            defaultValue={application.assigned_to ?? ""}
            placeholder="Nom du gérant ou responsable"
          />
        </label>
        <label>
          Date de l’entretien
          <input
            type="datetime-local"
            name="interview_at"
            defaultValue={toParisDateTimeLocal(application.interview_at)}
          />
        </label>
        <label>
          Note ajoutée à l’historique
          <input name="history_note" placeholder="Exemple : candidat contacté" />
        </label>
        <label className="form-span-2">
          Notes privées de la direction
          <textarea
            name="internal_notes"
            rows={4}
            defaultValue={application.internal_notes ?? ""}
            placeholder="Ces notes ne sont jamais visibles par le candidat."
          />
        </label>
        <label className="form-span-2">
          Réponse visible par le candidat
          <textarea
            name="manager_response"
            rows={5}
            defaultValue={application.manager_response ?? ""}
            placeholder="Décision, heure d’entretien ou message personnalisé..."
          />
        </label>
        <div className="dashboard-inline-actions form-span-2">
          <button type="submit" className="btn">
            Enregistrer le traitement
          </button>
          <RecruitmentResponseCopy
            candidateName={application.candidate_name}
            position={application.position}
            status={application.status}
            interviewAt={application.interview_at}
            managerResponse={application.manager_response}
          />
          {application.status === "accepted" && (
            <Link href="/dashboard/membres" className="secondary-button">
              Attribuer le rôle employé
            </Link>
          )}
        </div>
      </form>

      {history.length > 0 && (
        <details className="recruitment-history-v96">
          <summary>Historique du dossier ({history.length})</summary>
          <div>
            {history.slice(0, 10).map((entry) => (
              <p key={entry.id}>
                <strong>
                  {entry.from_status
                    ? `${statusLabels[entry.from_status] ?? entry.from_status} → `
                    : "Création → "}
                  {statusLabels[entry.to_status] ?? entry.to_status}
                </strong>
                {entry.note ? ` · ${entry.note}` : ""}
                <small>{formatParisDateTime(entry.created_at)}</small>
              </p>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
