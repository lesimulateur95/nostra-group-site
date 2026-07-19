import { redirect } from "next/navigation";
import { submitTeamRegistration } from "@/app/actions/backoffice";
import { EditablePage } from "@/components/site/editable-page";
import { getRpName } from "@/lib/auth/user-profile";
import { getTeamRegistrationModuleConfigured } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

type RegistrationType = "f1" | "gt3rs" | "both";

type RegistrationFormProps = {
  type: RegistrationType;
  applicantName: string;
  configured: boolean;
};

const FORM_COPY: Record<RegistrationType, {
  eyebrow: string;
  title: string;
  intro: string;
  button: string;
}> = {
  f1: {
    eyebrow: "CHAMPIONNAT FORMULE 1",
    title: "Inscription d’une écurie F1",
    intro: "Bienvenue dans le Championnat Officiel Formule 1 du Nostra Circuit. Les inscriptions sont ouvertes dans la limite des places disponibles.",
    button: "Envoyer l’inscription F1",
  },
  gt3rs: {
    eyebrow: "CHAMPIONNAT GT3 RS",
    title: "Inscription d’une écurie GT3 RS",
    intro: "Bienvenue dans le Championnat Officiel GT3 RS du Nostra Circuit. Les inscriptions sont ouvertes dans la limite des places disponibles.",
    button: "Envoyer l’inscription GT3 RS",
  },
  both: {
    eyebrow: "DOUBLE INSCRIPTION",
    title: "Inscription F1 + GT3 RS",
    intro: "Ce formulaire permet d’inscrire la même écurie aux deux championnats en une seule demande.",
    button: "Envoyer la double inscription",
  },
};

function LicenseChoice({ name, label, disabled }: { name: string; label: string; disabled: boolean }) {
  return (
    <fieldset className="team-license-choice" disabled={disabled}>
      <legend>{label}</legend>
      <label><input type="radio" name={name} value="yes" required /> Oui</label>
      <label><input type="radio" name={name} value="no" required /> Non</label>
    </fieldset>
  );
}

function RegistrationForm({ type, applicantName, configured }: RegistrationFormProps) {
  const copy = FORM_COPY[type];
  const includesF1 = type === "f1" || type === "both";
  const includesGt3rs = type === "gt3rs" || type === "both";

  return (
    <article className="team-registration-card">
      <header>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <p>{copy.intro}</p>
      </header>

      <form action={submitTeamRegistration} className="public-request-form team-registration-form">
        <input type="hidden" name="registration_type" value={type} />
        <label>Nom Prénom
          <input name="applicant_name" defaultValue={applicantName} required minLength={2} maxLength={120} disabled={!configured} />
        </label>
        <label>Nom de l’écurie
          <input name="team_name" required minLength={2} maxLength={120} placeholder="Nom officiel de l’écurie" disabled={!configured} />
        </label>
        <label>Directeur d’écurie
          <input name="team_director" required minLength={2} maxLength={120} defaultValue={applicantName} disabled={!configured} />
        </label>

        {includesF1 && (
          <label>Numéro F1 souhaité
            <input name="requested_number_f1" required maxLength={30} placeholder="Exemple : 95" disabled={!configured} />
          </label>
        )}
        {includesGt3rs && (
          <label>Numéro GT3 RS souhaité
            <input name="requested_number_gt3rs" required maxLength={30} placeholder="Exemple : 27" disabled={!configured} />
          </label>
        )}

        {includesF1 && <LicenseChoice name="has_f1_license" label="Licence F1" disabled={!configured} />}
        {includesGt3rs && <LicenseChoice name="has_gt3rs_license" label="Licence GT3 RS" disabled={!configured} />}

        <label className="form-span-2">Informations complémentaires <small>(facultatif)</small>
          <textarea name="notes" rows={5} maxLength={2500} disabled={!configured} />
        </label>

        <div className="team-registration-notice form-span-2">
          <p>Après validation de l’inscription, le Nostra Circuit procédera à l’attribution du véhicule ainsi qu’à son homologation officielle.</p>
          <p>Toute inscription sera étudiée par l’organisation avant validation.</p>
        </div>

        <button className="btn" type="submit" disabled={!configured}>{copy.button}</button>
      </form>
    </article>
  );
}

export default async function TeamCreationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const [params, configured] = await Promise.all([
    searchParams,
    getTeamRegistrationModuleConfigured(),
  ]);
  const applicantName = getRpName(data.user);

  const defaultContent = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">Administration sportive</p>
        <h1 className="page-title">Création et inscription d’une écurie</h1>
        <p className="document-intro">Choisis le championnat F1, le championnat GT3 RS ou les deux championnats en une seule demande.</p>
      </header>
      <section className="document-section">
        <h2>Fonctionnement</h2>
        <p>Chaque demande est transmise à la direction du Nostra Circuit. L’écurie n’est officielle qu’après validation de l’organisation.</p>
      </section>
    </article>
  );

  return (
    <>
      <EditablePage slug="creation-ecurie" defaultTitle="Création d’écurie">{defaultContent}</EditablePage>

      <section className="team-registration-section">
        {params.sent && (
          <div className="dashboard-feedback dashboard-feedback-success">
            Ta demande d’inscription a bien été envoyée à la direction du Nostra Circuit.
          </div>
        )}
        {params.error && (
          <div className="dashboard-feedback dashboard-feedback-error">
            {params.error === "setup"
              ? "Le module d’inscription doit encore être activé par la direction depuis le Dashboard."
              : params.error === "invalid"
                ? "Vérifie tous les champs obligatoires, les numéros souhaités et les licences."
                : "La demande n’a pas pu être enregistrée. Réessaie dans un instant."}
          </div>
        )}
        {!configured && (
          <div className="dashboard-feedback dashboard-feedback-error">
            Les inscriptions en ligne sont temporairement indisponibles. La direction doit activer le module depuis le Dashboard.
          </div>
        )}

        <div className="team-registration-grid">
          <RegistrationForm type="f1" applicantName={applicantName} configured={configured} />
          <RegistrationForm type="gt3rs" applicantName={applicantName} configured={configured} />
          <RegistrationForm type="both" applicantName={applicantName} configured={configured} />
        </div>
      </section>
    </>
  );
}
