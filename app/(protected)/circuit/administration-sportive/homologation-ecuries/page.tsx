import { redirect } from "next/navigation";
import { submitHomologationRequest } from "@/app/actions/backoffice";
import { EditablePage } from "@/components/site/editable-page";
import { getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export default async function HomologationEcuriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const params = await searchParams;

  const defaultContent = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">Administration sportive</p>
        <h1 className="page-title">Homologation des écuries</h1>
        <p className="document-intro">Déclare ton écurie officielle, ses pilotes, ses véhicules et son identité visuelle auprès du Nostra Circuit.</p>
      </header>
      <section className="document-section"><h2>Création officielle</h2><p>Chaque dossier est étudié par l’administration sportive avant validation et publication officielle.</p></section>
    </article>
  );

  return (
    <>
      <EditablePage slug="homologation-ecuries" defaultTitle="Homologation des écuries">{defaultContent}</EditablePage>

      <section className="request-form-section" id="demande">
        <div className="request-form-heading"><p className="eyebrow">FORMULAIRE EN LIGNE</p><h2>Demander l’homologation d’une écurie</h2><p>La direction recevra automatiquement le dossier dans son Dashboard.</p></div>
        {params.sent && <div className="dashboard-feedback dashboard-feedback-success">Ta demande d’écurie a bien été envoyée.</div>}
        {params.error && <div className="dashboard-feedback dashboard-feedback-error">Vérifie les informations du formulaire.</div>}
        <form action={submitHomologationRequest} className="public-request-form">
          <input type="hidden" name="request_type" value="team" />
          <input type="hidden" name="applicant_name" value={getRpName(data.user)} />
          <label>Nom de l’écurie<input name="team_name" required placeholder="Nom officiel" /></label>
          <label>Responsable<input name="owner_name" defaultValue={getRpName(data.user)} required /></label>
          <label>Couleurs / identité visuelle<input name="colors" placeholder="Exemple : noir et or" /></label>
          <label className="form-span-2">Liste des pilotes<textarea name="drivers" rows={5} placeholder="Un pilote par ligne" required /></label>
          <label className="form-span-2">Véhicules engagés<textarea name="vehicles" rows={5} placeholder="Véhicules et numéros" /></label>
          <label className="form-span-2">Informations complémentaires<textarea name="notes" rows={4} /></label>
          <button className="btn" type="submit">Envoyer le dossier</button>
        </form>
      </section>

    </>
  );
}
