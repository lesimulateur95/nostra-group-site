import Link from "next/link";

import { getCasinoConversions, getCasinoProfile, getCasinoWallet } from "@/lib/casino/data";
import styles from "@/components/casino/casino.module.css";

function n(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

export default async function CasinoProfilePage() {
  const [profile, wallet, conversions] = await Promise.all([
    getCasinoProfile(),
    getCasinoWallet(),
    getCasinoConversions(),
  ]);
  if (!profile) return null;
  const xpProgress = wallet ? wallet.xp % 1_000 : 0;

  return (
    <>
      <section className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>MON CERCLE</p><h1>Profil joueur</h1></div>
        <p>Ton identité casino, ton niveau, tes performances et l’historique de tes passages à la caisse.</p>
      </section>

      <section className={styles.profileHero}>
        <div className={styles.profileAvatar}>
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" />
          ) : profile.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className={styles.profileCopy}>
          <p className={styles.eyebrow}>MEMBRE DU CERCLE</p>
          <h1>{profile.displayName}</h1>
          <p>Steam {profile.steamId ? `•••• ${profile.steamId.slice(-4)}` : "non lié"} · Compte privé vérifié</p>
          <div className={styles.progressTrack}><div className={styles.progressBar} style={{ width: `${xpProgress / 10}%` }} /></div>
          <p>{n(xpProgress)} / 1 000 XP avant le prochain niveau</p>
        </div>
        <div className={styles.levelSeal}><span>NIVEAU<strong>{wallet?.level ?? 1}</strong></span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.statGrid}>
          <article className={styles.statCard}><span>Solde</span><strong>{wallet ? n(wallet.balance) : "—"}</strong><small>Jetons disponibles</small></article>
          <article className={styles.statCard}><span>Total misé</span><strong>{wallet ? n(wallet.lifetimeWagered) : "—"}</strong><small>Depuis l’ouverture</small></article>
          <article className={styles.statCard}><span>Total gagné</span><strong>{wallet ? n(wallet.lifetimeWon) : "—"}</strong><small>Gains bruts</small></article>
          <article className={styles.statCard}><span>Record</span><strong>{wallet ? n(wallet.biggestWin) : "—"}</strong><small>Plus gros gain</small></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.panelGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><p className={styles.eyebrow}>HISTORIQUE</p><h2>Passages à la caisse</h2></div></div>
            <div className={styles.historyList}>
              {conversions.length ? conversions.map((item) => (
                <div className={styles.historyRow} key={item.id}>
                  <span><strong>{n(item.chipAmount)} jetons</strong><small>{n(item.rpAmount)} € RP · {new Date(item.createdAt).toLocaleDateString("fr-FR")}</small></span>
                  <span className={styles[item.status]}>{item.status === "pending" ? "En attente" : item.status === "approved" ? "Validée" : item.status === "rejected" ? "Refusée" : "Annulée"}</span>
                </div>
              )) : <div className={styles.notice}>Aucune conversion enregistrée.</div>}
            </div>
          </article>
          <aside className={styles.panel}>
            <p className={styles.eyebrow}>CARTE DE MEMBRE</p>
            <h2>Privilèges du Cercle</h2>
            <p className={styles.lead}>Ton niveau évolue avec les parties jouées. Les tables privées et les tournois apparaîtront ici selon ton rang.</p>
            <Link href="/casino/jeux/poker" className={styles.primaryButton} style={{ marginTop: 20 }}>Jouer au poker</Link>
          </aside>
        </div>
      </section>
    </>
  );
}
