import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getOwnTeamRegistrationRequests } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileTeamsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const teams = await getOwnTeamRegistrationRequests(data.user.id);
  const championshipLabels: Record<string, string> = { f1: "F1", gt3rs: "GT3 RS", both: "F1 + GT3 RS" };
  const statusLabels: Record<string, string> = { pending: "En attente", reviewing: "En cours d’étude", approved: "Validée", rejected: "Refusée" };

  return (
    <>
      <ProfileSectionHeader eyebrow="NOSTRA CIRCUIT" title="Mes écuries" description="Consulte les écuries enregistrées et le suivi de leur inscription aux championnats." />
      <section className="profile-data-section profile-standalone-section">
        <div className="profile-data-heading"><div><p className="eyebrow">SPORT AUTOMOBILE</p><h2>Écuries et inscriptions</h2></div><span>{teams.length}</span></div>
        <div className="profile-table-wrap">
          <table className="profile-data-table">
            <thead><tr><th>Écurie</th><th>Championnat</th><th>Date</th><th>État</th><th>Réponse de la direction</th></tr></thead>
            <tbody>
              {teams.length === 0 && <tr><td colSpan={5} className="empty-table-cell">Aucune écurie enregistrée.</td></tr>}
              {teams.map((request) => <tr key={request.id}><td><strong>{request.team_name}</strong><small className="order-client-note">Directeur : {request.team_director}</small></td><td>{championshipLabels[request.registration_type] ?? request.registration_type}</td><td>{new Date(request.created_at).toLocaleDateString("fr-FR")}</td><td><span className={`request-status request-status-${request.status}`}>{statusLabels[request.status] ?? request.status}</span></td><td>{request.admin_note || "Aucune réponse pour le moment"}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
