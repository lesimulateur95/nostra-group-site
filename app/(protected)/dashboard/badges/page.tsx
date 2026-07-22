import Link from "next/link";
import {
  createProfileBadgeAction,
  grantProfileBadgeAction,
  refreshAutomaticProfileBadgesAction,
  revokeProfileBadgeAction,
} from "@/app/actions/profile-badges";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getBadgeAdministrationData } from "@/lib/profile-badges/data";
import styles from "@/components/badges/profile-badges.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

export default async function BadgeAdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ citoyen?: string }>;
}) {
  const params = await searchParams;
  const overview = await getBadgeAdministrationData();

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroActions}>
            <Link className={styles.backLink} href="/dashboard/citoyens">
              ← Retour aux fiches citoyens
            </Link>
            {overview.configured && (
              <form action={refreshAutomaticProfileBadgesAction}>
                <button className={styles.secondaryButton} type="submit">
                  Actualiser les succès automatiques
                </button>
              </form>
            )}
          </div>
          <p className={styles.eyebrow}>DIRECTION · SITE ET MEMBRES</p>
          <h1>Badges & succès</h1>
          <p>
            Attribue ou retire une récompense à un citoyen et crée de nouveaux badges
            personnalisés sans modifier le code du site.
          </p>
        </section>

        {!overview.configured ? (
          <section className={styles.panel}>
            <p className={styles.eyebrow}>ACTIVATION SUPABASE REQUISE</p>
            <h2>Le module des badges n’est pas encore activé</h2>
            <p>Exécute la migration Supabase V68 puis recharge cette page.</p>
            {overview.error && <div className={styles.error}>{overview.error}</div>}
          </section>
        ) : (
          <>
            <section className={styles.twoColumns}>
              <article className={styles.formCard}>
                <div>
                  <p className={styles.eyebrow}>ATTRIBUTION</p>
                  <h2>Donner un badge</h2>
                  <p>Le citoyen le verra immédiatement dans Profil → Mes badges.</p>
                </div>
                <form className={styles.formGrid} action={grantProfileBadgeAction}>
                  <label>
                    Citoyen
                    <select name="user_id" defaultValue={params.citoyen ?? ""} required>
                      <option value="">Sélectionner un citoyen</option>
                      {overview.members.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Badge
                    <select name="badge_id" required>
                      <option value="">Sélectionner un badge</option>
                      {overview.catalog
                        .filter((badge) => badge.is_active)
                        .map((badge) => (
                          <option key={badge.id} value={badge.id}>
                            {badge.icon} {badge.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className={styles.fullField}>
                    Note facultative
                    <textarea
                      name="note"
                      maxLength={300}
                      placeholder="Exemple : attribué lors du Grand Prix de Locmaria."
                    />
                  </label>
                  <button className={styles.primaryButton} type="submit">
                    Attribuer le badge
                  </button>
                </form>
              </article>

              <article className={styles.formCard}>
                <div>
                  <p className={styles.eyebrow}>CRÉATION</p>
                  <h2>Créer un badge personnalisé</h2>
                  <p>Il sera ensuite disponible dans la liste d’attribution.</p>
                </div>
                <form className={styles.formGrid} action={createProfileBadgeAction}>
                  <label>
                    Icône
                    <input name="icon" maxLength={12} defaultValue="🏅" />
                  </label>
                  <label>
                    Catégorie
                    <input name="category" maxLength={50} defaultValue="Général" />
                  </label>
                  <label>
                    Nom du badge
                    <input name="label" minLength={2} maxLength={80} required />
                  </label>
                  <label>
                    Code interne facultatif
                    <input name="code" maxLength={60} placeholder="client_vip" />
                  </label>
                  <label className={styles.fullField}>
                    Description
                    <textarea name="description" maxLength={240} required />
                  </label>
                  <button className={styles.primaryButton} type="submit">
                    Créer le badge
                  </button>
                </form>
              </article>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>HISTORIQUE</p>
                  <h2>Badges actuellement attribués</h2>
                </div>
                <span className={styles.counter}>{overview.awards.length}</span>
              </div>

              <div className={styles.awardList}>
                {overview.awards.length === 0 && (
                  <div className={styles.empty}>Aucun badge attribué pour le moment.</div>
                )}
                {overview.awards.map((award) => (
                  <article className={styles.awardRow} key={award.id}>
                    <span className={styles.badgeIcon} aria-hidden="true">
                      {award.badge_icon}
                    </span>
                    <div>
                      <strong>
                        {award.badge_label} · {award.member_name}
                      </strong>
                      <small>
                        {formatDate(award.awarded_at)} · {award.award_source}
                        {award.note ? ` · ${award.note}` : ""}
                      </small>
                    </div>
                    <form action={revokeProfileBadgeAction}>
                      <input type="hidden" name="user_id" value={award.user_id} />
                      <input type="hidden" name="badge_id" value={award.badge_id} />
                      <button className={styles.dangerButton} type="submit">
                        Retirer
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>CATALOGUE</p>
                  <h2>Badges disponibles</h2>
                </div>
                <span className={styles.counter}>{overview.catalog.length}</span>
              </div>
              <div className={styles.badgeGrid}>
                {overview.catalog.map((badge) => (
                  <article className={styles.badgeCard} key={badge.id}>
                    <span className={styles.badgeIcon} aria-hidden="true">
                      {badge.icon}
                    </span>
                    <div>
                      <strong>{badge.label}</strong>
                      <p>{badge.description}</p>
                      <div className={styles.badgeMeta}>
                        <span className={styles.tag}>{badge.category}</span>
                        <span className={badge.is_active ? styles.earnedTag : styles.lockedTag}>
                          {badge.is_active ? "Disponible" : "Désactivé"}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
