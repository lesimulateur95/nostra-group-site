import { redirect } from "next/navigation";
import { saveRpProfile } from "@/app/actions/profile";
import { Topbar } from "@/components/site/topbar";
import {
  getAvatarUrl,
  getDiscordId,
  getDiscordName,
  getRpName,
  getSiteRole,
  hasRpProfile,
} from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

type ProfilePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const params = await searchParams;
  const metadata = data.user.user_metadata ?? {};
  const avatarUrl = getAvatarUrl(data.user);
  const rpName = getRpName(data.user);
  const complete = hasRpProfile(data.user);
  const role = getSiteRole(data.user);

  const errorMessage =
    params.error === "invalid_name"
      ? "Entre un prénom et un nom RP valides, entre 2 et 32 caractères."
      : params.error === "save_failed"
        ? "Le profil n’a pas pu être sauvegardé. Réessaie dans un instant."
        : null;

  return (
    <div className="site-shell">
      <Topbar />
      <main className="profile-main">
        <section className="profile-heading">
          <span className="eyebrow">ESPACE PERSONNEL</span>
          <h1 className="page-title">Mon profil</h1>
          <p className="lead">
            Discord sert uniquement à sécuriser la connexion. Ton identité affichée sur Nostra Group est ton nom RP.
          </p>
        </section>

        <div className="profile-layout">
          <aside className="profile-card profile-summary">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="profile-avatar" src={avatarUrl} alt="Avatar Discord" />
            ) : (
              <div className="profile-avatar profile-avatar-fallback">NG</div>
            )}
            <div>
              <span className="profile-label">Nom RP</span>
              <strong className="profile-name">{rpName || "À compléter"}</strong>
            </div>
            <dl className="profile-details">
              <div><dt>Compte Discord</dt><dd>{getDiscordName(data.user)}</dd></div>
              <div><dt>Rôle</dt><dd><span className="role-badge">{role}</span></dd></div>
              <div><dt>Identifiant Discord</dt><dd>{getDiscordId(data.user) ?? "Non détecté"}</dd></div>
              <div><dt>E-mail</dt><dd>{data.user.email ?? "Non communiqué"}</dd></div>
            </dl>
          </aside>

          <section className="profile-card profile-form-card">
            <div className="profile-form-title">
              <div>
                <span className="eyebrow">IDENTITÉ RP</span>
                <h2>{complete ? "Modifier mon identité" : "Créer mon identité RP"}</h2>
              </div>
              {!complete && <span className="required-badge">Obligatoire</span>}
            </div>

            <p className="profile-help">
              Ces informations seront utilisées sur le site à la place de ton pseudo Discord. Tu pourras les modifier plus tard.
            </p>

            {errorMessage && <p className="form-error">{errorMessage}</p>}

            <form action={saveRpProfile} className="profile-form">
              <label>
                <span>Prénom RP</span>
                <input
                  name="rp_first_name"
                  required
                  minLength={2}
                  maxLength={32}
                  defaultValue={typeof metadata.rp_first_name === "string" ? metadata.rp_first_name : ""}
                  placeholder="Exemple : Liam"
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Nom RP</span>
                <input
                  name="rp_last_name"
                  required
                  minLength={2}
                  maxLength={32}
                  defaultValue={typeof metadata.rp_last_name === "string" ? metadata.rp_last_name : ""}
                  placeholder="Exemple : Nostra"
                  autoComplete="off"
                />
              </label>
              <button className="btn profile-submit" type="submit">
                {complete ? "Enregistrer les modifications" : "Valider mon profil"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
