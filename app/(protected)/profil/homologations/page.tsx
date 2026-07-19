import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getOwnHomologationRequests } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileHomologationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const homologations = await getOwnHomologationRequests(data.user.id);
  const statusLabels: Record<string, string> = { pending: "En attente", reviewing: "En cours d’étude", approved: "Validée", rejected: "Refusée" };

  return (
    <>
      <ProfileSectionHeader eyebrow="NOSTRA CIRCUIT" title="Mes homologations" description="Retrouve les demandes envoyées et la réponse de la Direction du Nostra Circuit." />
      <section className="profile-data-section profile-standalone-section">
        <div className="profile-data-heading"><div><p className="eyebrow">MES DOSSIERS</p><h2>Demandes d’homologation</h2></div><span>{homologations.length}</span></div>
        <div className="profile-table-wrap">
          <table className="profile-data-table">
            <thead><tr><th>Type</th><th>Dossier</th><th>Date</th><th>État</th><th>Réponse de la direction</th></tr></thead>
            <tbody>
              {homologations.length === 0 && <tr><td colSpan={5} className="empty-table-cell">Aucune demande d’homologation envoyée.</td></tr>}
              {homologations.map((request) => {
                const title = request.request_type === "vehicle" ? String(request.payload.vehicle_name || "Véhicule") : String(request.payload.team_name || "Écurie");
                return <tr key={request.id}><td>{request.request_type === "vehicle" ? "Véhicule" : "Écurie"}</td><td><strong>{title}</strong></td><td>{new Date(request.created_at).toLocaleDateString("fr-FR")}</td><td><span className={`request-status request-status-${request.status}`}>{statusLabels[request.status] ?? request.status}</span></td><td>{request.admin_note || "Aucune réponse pour le moment"}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
