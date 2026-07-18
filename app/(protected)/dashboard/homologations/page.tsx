import { updateHomologationRequest } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getHomologationRequests } from "@/lib/backoffice/data";

const labels: Record<string, string> = {
  vehicle_name: "Véhicule",
  vehicle_model: "Modèle",
  plate: "Plaque",
  category: "Catégorie",
  modifications: "Modifications",
  team_name: "Écurie",
  owner_name: "Responsable",
  drivers: "Pilotes",
  vehicles: "Véhicules",
  colors: "Couleurs",
  notes: "Informations complémentaires",
};

export default async function HomologationsDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const requests = await getHomologationRequests();

  return (
    <DashboardShell>
      <DashboardHeader title="Demandes d’homologation" description="Les formulaires envoyés depuis les pages Véhicules et Écuries arrivent ici automatiquement." />
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">La demande a été mise à jour.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de traiter cette demande.</div>}

      <section className="homologation-admin-list">
        {requests.length === 0 && <div className="backoffice-panel empty-state">Aucune demande d’homologation reçue.</div>}
        {requests.map((request) => (
          <article className="backoffice-panel homologation-admin-card" key={request.id}>
            <div className="homologation-admin-head">
              <div>
                <span className={`request-status request-status-${request.status}`}>{request.status}</span>
                <h2>{request.request_type === "vehicle" ? "Homologation d’un véhicule" : "Homologation d’une écurie"}</h2>
                <p>Demande de <strong>{request.applicant_name}</strong> · {new Date(request.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <strong>#{request.id}</strong>
            </div>

            <dl className="request-data-grid">
              {Object.entries(request.payload ?? {}).map(([key, value]) => (
                <div key={key}><dt>{labels[key] ?? key}</dt><dd>{String(value || "—")}</dd></div>
              ))}
            </dl>

            <form action={updateHomologationRequest} className="backoffice-form homologation-review-form">
              <input type="hidden" name="id" value={request.id} />
              <label>Décision<select name="status" defaultValue={request.status}><option value="pending">En attente</option><option value="reviewing">En cours d’étude</option><option value="approved">Validée</option><option value="rejected">Refusée</option></select></label>
              <label className="form-span-2">Note visible par le demandeur<textarea name="admin_note" rows={4} defaultValue={request.admin_note ?? ""} /></label>
              <button className="btn" type="submit">Enregistrer la décision</button>
            </form>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
