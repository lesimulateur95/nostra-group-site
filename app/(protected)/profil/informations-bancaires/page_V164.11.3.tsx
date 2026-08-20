import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BankRefreshButton } from "@/components/profile/bank-refresh-button";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getCitizenBankInformation } from "@/lib/game-bank/data";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number | null): string {
  if (value === null) return "—";
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function maskSteamId(steamId: string | null): string {
  if (!steamId) return "Non lié";
  return `•••• ${steamId.slice(-4)}`;
}

function formatCheckedAt(value: string | null): string {
  if (!value) return "En attente de connexion";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function BankingLoading({
  steamId,
  profileName,
}: {
  steamId: string | null;
  profileName: string;
}) {
  return (
    <>
      <section className={styles.identityBar}>
        <div>
          <span className={styles.onlineDot} aria-hidden="true" />
          <p>
            <small>Compte citoyen</small>
            <strong>{profileName || "Citoyen Nostra"}</strong>
          </p>
        </div>
        <dl>
          <div>
            <dt>Identifiant Steam lié</dt>
            <dd>{maskSteamId(steamId)}</dd>
          </div>
          <div>
            <dt>Dernière consultation</dt>
            <dd>Connexion en cours…</dd>
          </div>
        </dl>
      </section>

      <section className={styles.unavailable}>
        <span className={styles.lockIcon} aria-hidden="true">🏦</span>
        <p className={styles.eyebrow}>CONNEXION À LA BANQUE</p>
        <h2>Récupération de tes soldes…</h2>
        <p>
          La page est déjà disponible. Seules les informations bancaires sont en cours de récupération.
        </p>
      </section>
    </>
  );
}

async function BankingContent({
  steamId,
  profileName,
}: {
  steamId: string | null;
  profileName: string;
}) {
  const banking = await getCitizenBankInformation(steamId);
  const citizenName = banking.citizenName || profileName || "Citoyen Nostra";

  const unavailableCopy =
    banking.status === "identity_missing"
      ? {
          eyebrow: "COMPTE NON LIÉ",
          title: "Ajoute ton identifiant Steam",
          text: "Ton compte du site doit être lié au même identifiant Steam que celui utilisé en jeu pour retrouver tes finances.",
        }
      : banking.status === "not_found"
        ? {
            eyebrow: "COMPTE EN JEU INTROUVABLE",
            title: "Aucune donnée bancaire pour le moment",
            text: "Ton profil est bien lié, mais aucun personnage correspondant n’a encore été trouvé dans la base du serveur.",
          }
        : banking.status === "unavailable"
          ? {
              eyebrow: "SERVICE TEMPORAIREMENT INDISPONIBLE",
              title: "La banque du serveur ne répond pas",
              text: "La page reste accessible normalement. Réessaie uniquement la consultation des soldes dans un instant.",
            }
          : {
              eyebrow: "BIENTÔT DISPONIBLE",
              title: "Connexion prévue à l’ouverture du serveur",
              text: "Cette page est prête. Les comptes et l’argent en jeu apparaîtront automatiquement dès que la base du serveur sera reliée au site.",
            };

  return (
    <>
      <section className={styles.identityBar}>
        <div>
          <span className={styles.onlineDot} aria-hidden="true" />
          <p>
            <small>Compte citoyen</small>
            <strong>{citizenName}</strong>
          </p>
        </div>
        <dl>
          <div>
            <dt>Identifiant Steam lié</dt>
            <dd>{maskSteamId(steamId)}</dd>
          </div>
          <div>
            <dt>Dernière consultation</dt>
            <dd>{formatCheckedAt(banking.checkedAt)}</dd>
          </div>
        </dl>
        {banking.status === "connected" && <BankRefreshButton />}
      </section>

      {banking.status === "connected" ? (
        <>
          <section className={styles.heroBalance}>
            <div>
              <p className={styles.eyebrow}>PATRIMOINE DISPONIBLE</p>
              <span>Solde total en jeu</span>
              <strong>{money(banking.total)}</strong>
              <small>Banque et espèces cumulées</small>
            </div>
            <span className={styles.bankMark} aria-hidden="true">NG</span>
          </section>

          <section className={styles.accountsSection}>
            <header>
              <div>
                <p className={styles.eyebrow}>MES COMPTES</p>
                <h2>Détail des soldes</h2>
              </div>
              <span className={styles.readOnlyBadge}>Lecture seule</span>
            </header>

            <div className={styles.accountGrid}>
              {banking.accounts.map((account, index) => (
                <article className={styles.accountCard} key={account.key}>
                  <span className={styles.accountIcon} aria-hidden="true">
                    {index === 0 ? "🏦" : "◆"}
                  </span>
                  <div>
                    <small>COMPTE BANCAIRE</small>
                    <h3>{account.label}</h3>
                    <strong>{money(account.balance)}</strong>
                  </div>
                  <span className={styles.activeBadge}>Actif</span>
                </article>
              ))}

              <article className={`${styles.accountCard} ${styles.cashCard}`}>
                <span className={styles.accountIcon} aria-hidden="true">💶</span>
                <div>
                  <small>PORTEFEUILLE</small>
                  <h3>Argent liquide</h3>
                  <strong>{money(banking.cash)}</strong>
                </div>
                <span className={styles.activeBadge}>En jeu</span>
              </article>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.unavailable}>
          <span className={styles.lockIcon} aria-hidden="true">🏦</span>
          <p className={styles.eyebrow}>{unavailableCopy.eyebrow}</p>
          <h2>{unavailableCopy.title}</h2>
          <p>{unavailableCopy.text}</p>
          {banking.status === "unavailable" && <BankRefreshButton />}
        </section>
      )}
    </>
  );
}

export default async function BankingInformationPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("steam_id,rp_first_name,rp_last_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const steamId =
    typeof profile?.steam_id === "string" && profile.steam_id.trim()
      ? profile.steam_id.trim()
      : typeof data.user.user_metadata?.steam_id === "string" &&
          data.user.user_metadata.steam_id.trim()
        ? data.user.user_metadata.steam_id.trim()
        : null;

  const profileName = [profile?.rp_first_name, profile?.rp_last_name]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ");

  return (
    <main className={styles.page}>
      <ProfileSectionHeader
        eyebrow="ESPACE CITOYEN"
        title="Informations bancaires"
        description="Consulte tes comptes et ton argent en jeu depuis un espace personnel sécurisé en lecture seule."
      />

      <Suspense
        fallback={<BankingLoading steamId={steamId} profileName={profileName} />}
      >
        <BankingContent steamId={steamId} profileName={profileName} />
      </Suspense>

      <aside className={styles.securityNote}>
        <span aria-hidden="true">🔒</span>
        <div>
          <strong>Données personnelles protégées</strong>
          <p>
            Les soldes sont consultés côté serveur à partir du compte Steam lié.
            Aucun citoyen ne peut afficher les finances d’un autre joueur et aucune
            opération bancaire ne peut être effectuée depuis cette page.
          </p>
        </div>
      </aside>
    </main>
  );
}
