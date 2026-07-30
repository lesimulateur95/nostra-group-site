import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SteamLinkDiscordButton } from "@/components/auth/steam-link-discord-button";
import {
  decodePendingCookie,
  STEAM_PENDING_AVATAR_COOKIE,
  STEAM_PENDING_ID_COOKIE,
  STEAM_PENDING_NAME_COOKIE,
} from "@/lib/auth/steam";
import styles from "@/components/auth/steam-association.module.css";

export default async function SteamAssociationPage() {
  const cookieStore = await cookies();
  const steamId = cookieStore.get(STEAM_PENDING_ID_COOKIE)?.value ?? "";
  if (!/^\d{17}$/.test(steamId)) redirect("/");

  const personaName =
    decodePendingCookie(
      cookieStore.get(STEAM_PENDING_NAME_COOKIE)?.value,
    ) || `Compte Steam ${steamId.slice(-6)}`;
  const avatarUrl =
    decodePendingCookie(
      cookieStore.get(STEAM_PENDING_AVATAR_COOKIE)?.value,
    ) || null;

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>CONNEXION STEAM</span>
        <h1>Compte Steam reconnu</h1>
        <p className={styles.intro}>
          Ce compte Steam n’est pas encore relié à un compte Nostra Group.
          Choisis l’option correspondant à ta situation.
        </p>

        <div className={styles.identity}>
          {avatarUrl ? (
            <img
              alt={`Avatar Steam de ${personaName}`}
              className={styles.avatar}
              height={72}
              src={avatarUrl}
              width={72}
            />
          ) : (
            <span className={styles.avatarFallback}>S</span>
          )}
          <div>
            <strong>{personaName}</strong>
            <small>Steam ID : {steamId}</small>
          </div>
        </div>

        <div className={styles.options}>
          <section className={styles.option}>
            <h2>J’ai déjà un compte Nostra Group</h2>
            <p>
              Connecte-toi une seule fois avec Discord. Ton compte Steam sera
              relié à ton profil actuel, avec tes rôles, commandes, licences et
              données existantes.
            </p>
            <SteamLinkDiscordButton />
          </section>

          <section className={styles.option}>
            <h2>Je suis un nouveau citoyen</h2>
            <p>
              Crée un nouveau compte Nostra Group avec Steam. Tu compléteras
              ensuite ton nom et ton prénom RP dans ton profil.
            </p>
            <form action="/auth/steam/create" method="post">
              <button className={styles.createButton} type="submit">
                Créer mon compte avec Steam
              </button>
            </form>
          </section>
        </div>

        <Link className={styles.cancelLink} href="/">
          Annuler et revenir à la connexion
        </Link>
      </section>
    </main>
  );
}
