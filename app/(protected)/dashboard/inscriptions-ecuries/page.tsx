import { deleteTeamRegistration, updateTeamRegistration } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getTeamRegistrationModuleConfigured,
  getTeamRegistrationRequests,
  type TeamRegistrationRequest,
} from "@/lib/backoffice/data";
import { TEAM_REGISTRATIONS_SETUP_SQL } from "@/lib/backoffice/team-registrations-setup-sql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<TeamRegistrationRequest["status"], string> = {
  pending: "Nouvelle demande",
  reviewing: "En cours d’étude",
  approved: "Validée",
  rejected: "Refusée",
};

const championshipLabels: Record<TeamRegistrationRequest["registration_type"], string> = {
  f1: "Championnat F1",
  gt3rs: "Championnat GT3 RS",
  both: "F1 + GT3 RS",
};

export default async function TeamRegistrationsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const configured = await getTeamRegistrationModuleConfigured();
  const requests = configured ? await getTeamRegistrationRequests() : [];
  const pending = requests.filter((request) => request.status === "pending" || request.status === "reviewing");
  const processed = requests.filter((request) => request.status === "approved" || request.status === "rejected");

  return (
    <DashboardShell>
      <DashboardHeader
        title="Inscriptions des écuries"
        description="Reçois et traite les inscriptions F1, GT3 RS ou les doubles inscriptions envoyées depuis l’administration sportive."
      />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les formulaires de création d’écurie</h2>
          <p>Ce script crée la boîte de réception des inscriptions et permet aux citoyens de suivre une demande sécurisée liée à leur compte.</p>
          <details open>
            <summary>Afficher le code SQL V23 à copier dans Supabase</summary>
            <pre>{TEAM_REGISTRATIONS_SETUP_SQL}</pre>
          </details>
          <ol>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle tout le code et clique sur <strong>Run query</strong>.</li>
            <li>Reviens ici puis fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      )}

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">La demande d’écurie a été mise à jour.</div>}
      {params.deleted && <div className="dashboard-feedback">La demande a été supprimée définitivement.</div>}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "setup" ? "Active d’abord le module avec le code SQL V23 affiché ci-dessus." : "Impossible de traiter cette demande."}
        </div>
      )}

      {configured && (
        <>
          <section className="reservation-admin-summary">
            <article><span>À traiter</span><strong>{pending.length}</strong></article>
            <article><span>Total reçu</span><strong>{requests.length}</strong></article>
            <article><span>Validées</span><strong>{requests.filter((request) => request.status === "approved").length}</strong></article>
          </section>

          <section className="team-registration-admin-list">
            {pending.length === 0 && <div className="backoffice-panel empty-state">Aucune inscription d’écurie en attente.</div>}
            {pending.map((request) => <TeamRegistrationCard request={request} key={request.id} />)}
          </section>

          {processed.length > 0 && (
            <section className="processed-reservations">
              <div className="dashboard-section-heading dashboard-section-heading-tight">
                <p className="eyebrow">HISTORIQUE</p>
                <h2>Demandes validées ou refusées</h2>
              </div>
              <div className="team-registration-admin-list">
                {processed.map((request) => <TeamRegistrationCard request={request} key={request.id} />)}
              </div>
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}

function TeamRegistrationCard({ request }: { request: TeamRegistrationRequest }) {
  return (
    <article className="backoffice-panel team-registration-admin-card">
      <div className="homologation-admin-head">
        <div>
          <span className={`request-status request-status-${request.status}`}>{statusLabels[request.status]}</span>
          <h2>{request.team_name}</h2>
          <p>{championshipLabels[request.registration_type]} · demande de {request.applicant_name}</p>
        </div>
        <span>{new Date(request.created_at).toLocaleString("fr-FR")}</span>
      </div>

      <dl className="request-data-grid team-registration-data-grid">
        <div><dt>Directeur d’écurie</dt><dd>{request.team_director}</dd></div>
        {(request.registration_type === "f1" || request.registration_type === "both") && (
          <div><dt>Numéro F1 souhaité</dt><dd>{request.requested_number_f1 || "Non renseigné"}</dd></div>
        )}
        {(request.registration_type === "gt3rs" || request.registration_type === "both") && (
          <div><dt>Numéro GT3 RS souhaité</dt><dd>{request.requested_number_gt3rs || "Non renseigné"}</dd></div>
        )}
        {(request.registration_type === "f1" || request.registration_type === "both") && (
          <div><dt>Licence F1</dt><dd>{request.has_f1_license ? "Oui" : "Non"}</dd></div>
        )}
        {(request.registration_type === "gt3rs" || request.registration_type === "both") && (
          <div><dt>Licence GT3 RS</dt><dd>{request.has_gt3rs_license ? "Oui" : "Non"}</dd></div>
        )}
      </dl>

      {request.notes && <div className="reservation-reason"><span>Informations complémentaires</span><p>{request.notes}</p></div>}

      <form action={updateTeamRegistration} className="backoffice-form homologation-review-form">
        <input type="hidden" name="id" value={request.id} />
        <label>État de la demande
          <select name="status" defaultValue={request.status}>
            <option value="pending">Nouvelle demande</option>
            <option value="reviewing">En cours d’étude</option>
            <option value="approved">Validée</option>
            <option value="rejected">Refusée</option>
          </select>
        </label>
        <label className="form-span-2">Réponse de la direction
          <textarea name="admin_note" rows={4} defaultValue={request.admin_note ?? ""} placeholder="Décision, véhicule attribué, numéro confirmé, rendez-vous…" />
        </label>
        <button className="btn" type="submit">Enregistrer la décision</button>
      </form>

      <form action={deleteTeamRegistration} className="danger-form">
        <input type="hidden" name="id" value={request.id} />
        <button type="submit">Supprimer définitivement la demande</button>
      </form>
    </article>
  );
}
