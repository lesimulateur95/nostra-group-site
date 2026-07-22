import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getMyProfileBadges } from "@/lib/profile-badges/data";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/badges/profile-badges.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}

export default async function ProfileBadgesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const collection = await getMyProfileBadges();
  const earnedCount = collection.badges.filter((badge) => badge.earned).length;

  return (
    <main className={styles.page}>
      <ProfileSectionHeader
        eyebrow="BADGES & SUCCÈS"
        title="Mes récompenses"
        description="Retrouve les badges obtenus grâce à tes achats, ta fidélité et ta participation aux activités Nostra Group."
      />

      {!collection.configured ? (
        <section className={styles.panel}>
          <p className={styles.eyebrow}>ACTIVATION SUPABASE REQUISE</p>
          <h2>Le module des badges n’est pas encore activé</h2>
          <p>Exécute la migration Supabase V68 puis recharge cette page.</p>
          {collection.error && <div className={styles.error}>{collection.error}</div>}
        </section>
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>COLLECTION</p>
              <h2>{earnedCount} badge(s) obtenu(s)</h2>
              <p>Les badges grisés ne sont pas encore débloqués.</p>
            </div>
            <span className={styles.counter}>
              {earnedCount}/{collection.badges.length}
            </span>
          </div>

          <div className={styles.badgeGrid}>
            {collection.badges.map((badge) => (
              <article
                className={`${styles.badgeCard} ${
                  badge.earned ? "" : styles.badgeCardLocked
                }`}
                key={badge.id}
              >
                <span className={styles.badgeIcon} aria-hidden="true">
                  {badge.icon}
                </span>
                <div>
                  <strong>{badge.label}</strong>
                  <p>{badge.description}</p>
                  <div className={styles.badgeMeta}>
                    <span className={styles.tag}>{badge.category}</span>
                    {badge.earned ? (
                      <span className={styles.earnedTag}>
                        Obtenu{badge.awarded_at ? ` le ${formatDate(badge.awarded_at)}` : ""}
                      </span>
                    ) : (
                      <span className={styles.lockedTag}>À débloquer</span>
                    )}
                  </div>
                  {badge.earned && badge.note && <p>{badge.note}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
