import { redirect } from "next/navigation";
import { submitHomologationRequest } from "@/app/actions/backoffice";
import { EditablePage } from "@/components/site/editable-page";
import { getRpName } from "@/lib/auth/user-profile";
import { getOwnHomologationRequests } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  reviewing: "En cours d’étude",
  approved: "Validée",
  rejected: "Refusée",
};

export default async function HomologationVehiculesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const params = await searchParams;
  const requests = (await getOwnHomologationRequests(data.user.id)).filter((request) => request.request_type === "vehicle");

  const defaultContent = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">Administration sportive</p>
        <h1 className="page-title">Homologation des véhicules</h1>
        <p className="document-intro">Consulte les règles publiées par la direction, puis envoie directement ta demande d’homologation depuis le formulaire ci-dessous.</p>
      </header>
      <section className="document-section"><h2>Contrôle officiel</h2><p>Le véhicule devra être présenté au personnel du circuit. La demande en ligne permet de préparer le dossier avant le contrôle.</p></section>
    </article>
  );

  return (
    <>
      <EditablePage slug="homologation-vehicules" defaultTitle="Homologation des véhicules">{defaultContent}</EditablePage>

      <section className="request-form-section" id="demande">
        <div className="request-form-heading"><p className="eyebrow">FORMULAIRE EN LIGNE</p><h2>Demander l’homologation d’un véhicule</h2><p>La demande arrivera automatiquement dans la fenêtre Homologations du Dashboard Gérant.</p></div>
        {params.sent && <div className="dashboard-feedback dashboard-feedback-success">Ta demande a bien été envoyée.</div>}
        {params.error && <div className="dashboard-feedback dashboard-feedback-error">Vérifie les informations du formulaire.</div>}
        <form action={submitHomologationRequest} className="public-request-form">
          <input type="hidden" name="request_type" value="vehicle" />
          <input type="hidden" name="applicant_name" value={getRpName(data.user)} />
          <label>Nom du véhicule<input name="vehicle_name" required placeholder="Exemple : Porsche 911 GT3 RS" /></label>
          <label>Modèle exact<input name="vehicle_model" required placeholder="Année, version ou préparation" /></label>
          <label>Plaque / identification<input name="plate" placeholder="Si disponible" /></label>
          <label>Catégorie souhaitée<input name="category" placeholder="F1, GT3 RS, exposition…" /></label>
          <label className="form-span-2">Modifications du véhicule<textarea name="modifications" rows={5} placeholder="Moteur, châssis, aérodynamique, sécurité…" /></label>
          <label className="form-span-2">Informations complémentaires<textarea name="notes" rows={4} /></label>
          <button className="btn" type="submit">Envoyer la demande</button>
        </form>
      </section>

      <section className="own-requests-section">
        <h2>Mes demandes de véhicules</h2>
        {requests.length === 0 && <p className="empty-state">Tu n’as encore envoyé aucune demande.</p>}
        <div className="own-request-grid">
          {requests.map((request) => (
            <article className="own-request-card" key={request.id}>
              <span className={`request-status request-status-${request.status}`}>{statusLabels[request.status] ?? request.status}</span>
              <h3>{String(request.payload.vehicle_name || "Véhicule")}</h3>
              <p>Envoyée le {new Date(request.created_at).toLocaleDateString("fr-FR")}</p>
              {request.admin_note && <blockquote>{request.admin_note}</blockquote>}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
