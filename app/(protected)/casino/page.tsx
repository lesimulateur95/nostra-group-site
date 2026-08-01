import Link from "next/link";

import { getCasinoGameSettings, getCasinoLeaderboard, getCasinoProfile, getCasinoSettings, getCasinoWallet } from "@/lib/casino/data";
import type { CasinoGameKey } from "@/lib/casino/types";
import styles from "@/components/casino/casino.module.css";

const games = [
  { key: "poker", label: "Texas Hold’em", kicker: "JEU SIGNATURE", symbol: "♠", text: "Affronte les joueurs du Cercle ou entraîne-toi face aux croupiers virtuels.", meta: ["Solo", "Tables privées", "2–8 joueurs"] },
  { key: "double_or_quit", label: "Double ou quitte", kicker: "JUSQU’OÙ IRAS-TU ?", symbol: "×2", text: "Double ta mise encore et encore, ou quitte la table au bon moment pour encaisser.", meta: ["Solo", "À étapes", "Risque total"] },
  { key: "roulette", label: "Roulette", kicker: "TABLE CLASSIQUE", symbol: "◉", text: "La bille, le tapis et les mises mythiques du casino.", meta: ["Solo", "Direct"] },
  { key: "blackjack", label: "Blackjack", kicker: "VINGT-ET-UN", symbol: "21", text: "Approche 21 sans dépasser et bats la main de la maison.", meta: ["Solo", "Croupier"] },
  { key: "slots", label: "Machines à sous", kicker: "JACKPOT", symbol: "✦", text: "Trois rouleaux, plusieurs combinaisons et des gains instantanés.", meta: ["Solo", "Instantané"] },
  { key: "plinko", label: "Plinko", kicker: "LA BILLE TOMBE", symbol: "▽", text: "Choisis le risque et regarde la bille trouver son multiplicateur.", meta: ["Solo", "Risque"] },
  { key: "dice", label: "Dés", kicker: "LE SORT DES DÉS", symbol: "⚄", text: "Prédit au-dessus ou en dessous et laisse parler le hasard.", meta: ["Solo", "Rapide"] },
  { key: "coinflip", label: "Pile ou face", kicker: "50 / 50", symbol: "?", text: "Un choix, une pièce et un résultat immédiat.", meta: ["Solo", "Duel"] },
];

function n(value: number): string {
  return Math.trunc(value).toLocaleString("fr-FR");
}

export default async function CasinoHomePage() {
  const [profile, settings, wallet, leaderboard, gameSettings] = await Promise.all([
    getCasinoProfile(),
    getCasinoSettings(),
    getCasinoWallet(),
    getCasinoLeaderboard(),
    getCasinoGameSettings(),
  ]);
  const availability = new Map(gameSettings.map((game) => [game.game, game.enabled]));

  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>BIENVENUE AU CERCLE</p>
          <h1 className={styles.displayTitle}>
            Là où le jeu devient <em>un art.</em>
          </h1>
          <p className={styles.lead}>
            Bonsoir {profile?.displayName ?? "joueur"}. Entre dans une maison de jeux privée,
            imaginée pour les citoyens de Universe Life : tables raffinées, jetons RP et parties
            suivies en temps réel.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/casino/jeux/poker">♠ Rejoindre une table</Link>
            <Link className={styles.secondaryButton} href="/casino/caisse">◉ Acheter des jetons</Link>
          </div>
        </div>

        <div className={styles.heroTable} aria-label="Table de poker du Cercle">
          <div className={styles.pokerTable}>
            <span className={styles.floatingCard}>A♠</span>
            <span className={styles.floatingCard}>K♥</span>
            <span className={styles.tableChip} />
            <span className={styles.tableChip} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>TABLE OUVERTE</p>
            <h2>Choisis ton jeu</h2>
            <p>Des classiques du casino aux parties rapides, chaque résultat est calculé côté serveur.</p>
          </div>
          <Link className={styles.textLink} href="/casino/jeux/poker">Jeu signature →</Link>
        </div>
        <div className={styles.gameGrid}>
          {games.map((game) => {
            const enabled = availability.get(game.key as CasinoGameKey) !== false;
            return enabled ? (
            <Link className={styles.gameCard} href={`/casino/jeux/${game.key}`} key={game.key}>
              <span className={styles.gameArt} aria-hidden="true" />
              <span className={styles.gameSymbol}>{game.symbol}</span>
              <small>{game.kicker}</small>
              <h3>{game.label}</h3>
              <p>{game.text}</p>
              <span className={styles.gameMeta}>{game.meta.map((item) => <span key={item}>{item}</span>)}</span>
            </Link>
            ) : (
              <article className={`${styles.gameCard} ${styles.gameCardClosed}`} key={game.key}>
                <span className={styles.gameArt} aria-hidden="true" />
                <span className={styles.gameSymbol}>{game.symbol}</span>
                <small>TABLE FERMÉE</small><h3>{game.label}</h3><p>La Direction prépare actuellement cette salle.</p>
                <span className={styles.gameMeta}><span>Indisponible</span></span>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.statGrid}>
          <article className={styles.statCard}><span>Mes jetons</span><strong>{wallet ? n(wallet.balance) : "—"}</strong><small>Solde disponible</small></article>
          <article className={styles.statCard}><span>Parties jouées</span><strong>{wallet ? n(wallet.gamesPlayed) : "—"}</strong><small>Tous jeux confondus</small></article>
          <article className={styles.statCard}><span>Plus gros gain</span><strong>{wallet ? n(wallet.biggestWin) : "—"}</strong><small>Jetons sur une partie</small></article>
          <article className={styles.statCard}><span>Niveau Cercle</span><strong>{wallet ? wallet.level : 1}</strong><small>{wallet ? n(wallet.xp) : 0} XP</small></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.panelGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><p className={styles.eyebrow}>CLASSEMENT</p><h2>Les figures du Cercle</h2></div>
              <span className={styles.statusBadge}>SAISON ACTIVE</span>
            </div>
            <div className={styles.leaderboard}>
              {leaderboard.length ? leaderboard.map((row, index) => (
                <div className={styles.leaderRow} key={row.userId}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{row.displayName}</strong><small>Niveau {row.level} · {n(row.gamesPlayed)} parties</small></span>
                  <span className={styles.leaderValue}>{n(row.biggestWin)} max</span>
                </div>
              )) : <div className={styles.notice}>Le classement apparaîtra après les premières parties.</div>}
            </div>
          </article>
          <aside className={styles.panel}>
            <p className={styles.eyebrow}>LA CAISSE</p>
            <h2>Argent RP → jetons</h2>
            <p className={styles.lead}>Une conversion contrôlée relie ton argent en jeu à ton portefeuille du Cercle.</p>
            <div className={styles.notice} style={{ marginTop: 20 }}>
              1 jeton = {n(settings.rpPerChip)} € RP<br />
              Les demandes sont tracées et validées par la Direction.
            </div>
            <Link className={styles.primaryButton} style={{ marginTop: 16 }} href="/casino/caisse">Ouvrir la caisse</Link>
          </aside>
        </div>
      </section>
    </>
  );
}
