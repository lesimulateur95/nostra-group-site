import Link from "next/link";

import { adjustCasinoWallet, deleteCasinoCashierPackage, resetCasinoBeforeOpening, resetCasinoPlayer, saveCasinoCashierPackage, saveCasinoGameSettings, saveCasinoSettings } from "@/app/actions/casino";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCasinoAdminData, getCasinoCashierPackages, getCasinoSettings } from "@/lib/casino/data";
import type { CasinoGameKey } from "@/lib/casino/types";
import styles from "./casino-admin.module.css";

function n(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

const GAME_LABELS: Record<CasinoGameKey, { label: string; icon: string }> = {
  poker: { label: "Texas Hold’em", icon: "♠" },
  blackjack: { label: "Blackjack", icon: "21" },
  roulette: { label: "Roulette", icon: "◉" },
  slots: { label: "Machines à sous", icon: "✦" },
  dice: { label: "Dés", icon: "⚄" },
  plinko: { label: "Plinko", icon: "▽" },
  coinflip: { label: "Pile ou face", icon: "½" },
  double_or_quit: { label: "Double ou quitte", icon: "×2" },
  baccarat: { label: "Baccarat live", icon: "B" },
  mines: { label: "Mines", icon: "✹" },
  mystery_boxes: { label: "Coffres mystères", icon: "▣" },
  horse_racing: { label: "Courses hippiques", icon: "♞" },
  slots_tournament: { label: "Tournoi de machines", icon: "777" },
  card_battle: { label: "Bataille de cartes", icon: "A" },
  hi_lo: { label: "Hi-Lo", icon: "↕" },
  skyscraper: { label: "Gratte-ciel", icon: "▥" },
  memory: { label: "Memory Casino", icon: "◫" },
};

const DIFFICULTIES = {
  balanced: "Équilibré",
  hard: "Difficile",
  expert: "Très difficile",
  custom: "Personnalisé",
} as const;

const RESET_SUCCESS: Record<string, string> = {
  "opening-reset-complete": "Remise à zéro terminée : toutes les données Casino de test ont été définitivement effacées. Les réglages de Direction sont conservés.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CasinoDashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const [settings, admin, cashierPackages] = await Promise.all([getCasinoSettings(), getCasinoAdminData(), getCasinoCashierPackages(true)]);
  const recentPurchases = admin.conversions.slice(0, 30);
  const recentCashouts = admin.cashouts.slice(0, 30);
  const chipsInCirculation = admin.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const totalWagered = admin.gameStats.reduce((sum, stat) => sum + stat.wagered, 0);
  const totalPaid = admin.gameStats.reduce((sum, stat) => sum + stat.paid, 0);
  const houseProfit = totalWagered - totalPaid;
  const walletByUser = new Map(admin.wallets.map((wallet) => [wallet.userId, wallet]));

  return (
    <DashboardShell>
      <DashboardHeader eyebrow="DIRECTION · JEUX" title="Gestion du casino" description="Gère l’accès discret, la caisse, les jetons et les comptes joueurs directement depuis le Dashboard du site." />

      {!settings.configured && <section className="dashboard-setup"><span className="module-status">Activation V108 nécessaire</span><h2>Le casino reste entièrement masqué</h2><p>Exécute d’abord <strong>supabase/casino-le-cercle-v108.sql</strong>, puis le correctif <strong>supabase/casino-paiements-rp-reinitialisations-v109.sql</strong>. Tant que le premier SQL n’est pas exécuté, aucun citoyen ne voit le bouton Casino.</p></section>}
      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">{RESET_SUCCESS[params.saved] ?? "La gestion du casino a bien été mise à jour."}</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">L’opération n’a pas pu être enregistrée. {params.error === "setup" ? "Vérifie que les SQL Casino ont bien été exécutés." : params.error === "reset" ? "La réinitialisation a été bloquée. Vérifie la confirmation ou termine d’abord la partie active du joueur." : params.error === "opening-reset-confirmation" ? "Recopie exactement OUVRIR LE CASINO A ZERO." : params.error === "opening-reset-v114" ? "Vérifie que le SQL V114 a bien été exécuté, puis reconnecte-toi au site avant de réessayer." : params.error === "opening-reset-v113" ? "L’ancien bouton V113 est encore déployé. Remplace les fichiers du correctif V114." : params.error === "opening-reset" ? "Un ancien bouton de réinitialisation est encore déployé. Remplace les fichiers du correctif V114." : params.error === "game-settings" ? "Vérifie les pourcentages, les mises et les multiplicateurs de ce jeu." : "Vérifie les valeurs saisies."}</div>}

      <section className={styles.openingReset}>
        <div className={styles.openingResetCopy}>
          <span>PRÉPARATION AVANT OUVERTURE</span>
          <h2>Remettre le Casino à zéro à 100 %</h2>
          <p>Cette action efface définitivement tous les achats et conversions, transactions, parties, mises, gains, remboursements, tables de poker, soldes, niveaux, XP, statistiques et anciens journaux de réinitialisation.</p>
          <strong>Les réglages de Direction restent conservés : visibilité, taux RP, difficultés, pourcentages, mises et multiplicateurs.</strong>
        </div>
        <form action={resetCasinoBeforeOpening} className={styles.openingResetForm}>
          <label>
            <span>Pour confirmer, recopie exactement :</span>
            <b>OUVRIR LE CASINO A ZERO</b>
            <input name="confirmation" required autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit">Tout effacer et repartir à zéro</button>
          <small>L’argent RP de la base du serveur n’est jamais modifié par cette remise à zéro.</small>
        </form>
      </section>

      <section className="dashboard-kpi-grid">
        <article><span>Accès accueil</span><strong>{settings.publicEnabled ? "VISIBLE" : "MASQUÉ"}</strong></article>
        <article><span>Citoyens sélectionnables</span><strong>{admin.citizens.length}</strong></article>
        <article><span>Jetons en circulation</span><strong>{n(chipsInCirculation)}</strong></article>
        <article><span>Joueurs enregistrés</span><strong>{admin.wallets.length}</strong></article>
      </section>

      <section className={styles.controlHero}>
        <div>
          <span className={styles.controlEyebrow}>CENTRE DE CONTRÔLE</span>
          <h2>La banque garde la main sur chaque table.</h2>
          <p>Active les jeux un par un, impose les limites de mise et règle directement leur difficulté. Le taux de victoire est appliqué côté serveur : les joueurs ne peuvent ni le lire ni le modifier.</p>
        </div>
        <div className={styles.bankMetrics}>
          <article><span>Total misé</span><strong>{n(totalWagered)}</strong><small>jetons</small></article>
          <article><span>Total reversé</span><strong>{n(totalPaid)}</strong><small>jetons</small></article>
          <article className={houseProfit >= 0 ? styles.profit : styles.loss}><span>Résultat maison</span><strong>{houseProfit >= 0 ? "+" : ""}{n(houseProfit)}</strong><small>jetons</small></article>
          <article><span>RTP réel</span><strong>{totalWagered ? `${Math.round((totalPaid / totalWagered) * 10_000) / 100} %` : "0 %"}</strong><small>retour joueurs</small></article>
        </div>
      </section>

      <section className={styles.gamesSection}>
        <div className={styles.sectionHeading}>
          <div><span>RÉGLAGES INDÉPENDANTS</span><h2>Difficulté et gains par jeu</h2></div>
          <p>Plus le pourcentage est bas, plus le jeu est difficile. Les plafonds empêchent un gain supérieur au montant fixé, même avec un jackpot.</p>
        </div>
        <div className={styles.gameControlGrid}>
          {admin.gameSettings.map((game) => {
            const meta = GAME_LABELS[game.game];
            const stat = admin.gameStats.find((item) => item.game === game.game);
            return (
              <form action={saveCasinoGameSettings} className={styles.gameControlCard} key={game.game}>
                <input type="hidden" name="game" value={game.game} />
                <header>
                  <span className={styles.gameIcon}>{meta.icon}</span>
                  <div><small>{game.enabled ? "TABLE OUVERTE" : "TABLE FERMÉE"}</small><h3>{meta.label}</h3></div>
                  <label className={styles.switch}><input type="checkbox" name="enabled" value="true" defaultChecked={game.enabled} /><span /></label>
                </header>
                <div className={styles.liveStat}>
                  <span>{n(stat?.rounds ?? 0)} parties</span>
                  <span>{stat?.rtpPercent ? `${stat.rtpPercent} % RTP` : "Aucune donnée"}</span>
                  <span className={(stat?.houseProfit ?? 0) >= 0 ? styles.profitText : styles.lossText}>{(stat?.houseProfit ?? 0) >= 0 ? "+" : ""}{n(stat?.houseProfit ?? 0)} maison</span>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.wide}><span>Difficulté affichée</span><select name="difficulty" defaultValue={game.difficulty}>{Object.entries(DIFFICULTIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>Taux de victoire cible</span><div className={styles.inputSuffix}><input name="win_rate_percent" type="number" min="1" max="95" step="0.1" defaultValue={game.winRatePercent} required /><b>%</b></div></label>
                  {game.game === "double_or_quit" ? (
                    <label><span>Multiplicateur d’un double</span><div className={styles.inputSuffix}><input type="number" value="2" readOnly aria-label="Multiplicateur fixe" /><b>×</b></div></label>
                  ) : (
                    <label><span>Gain standard</span><div className={styles.inputSuffix}><input name="base_multiplier" type="number" min="0.1" max="100" step="0.1" defaultValue={game.baseMultiplier} required /><b>×</b></div></label>
                  )}
                  <label><span>Mise minimum</span><input name="min_bet" type="number" min="1" step="1" defaultValue={game.minBet} required /></label>
                  <label><span>Mise maximum</span><input name="max_bet" type="number" min="1" step="1" defaultValue={game.maxBet} required /></label>
                  {game.game === "double_or_quit" ? (
                    <><input type="hidden" name="base_multiplier" value="2" /><input type="hidden" name="jackpot_multiplier" value="2" /></>
                  ) : (
                    <label><span>Jackpot / gros gain</span><div className={styles.inputSuffix}><input name="jackpot_multiplier" type="number" min="0.1" max="1000" step="0.1" defaultValue={game.jackpotMultiplier} required /><b>×</b></div></label>
                  )}
                  <label><span>Gain maximum</span><input name="max_payout" type="number" min="1" step="1" defaultValue={game.maxPayout} required /></label>
                </div>
                <button className={styles.saveGameButton} type="submit">Enregistrer {meta.label}</button>
              </form>
            );
          })}
        </div>
        <p className={styles.rateNote}>Le taux est une cible serveur pour les jeux contre la Maison. Les tables live entre citoyens utilisent les règles réelles : roulette européenne, blackjack au croupier et baccarat sans résultat forcé. Les limites d’ouverture et de mise restent imposées par la Direction.</p>
      </section>

      <section className="tombola-dashboard-controls">
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">♠</span><div><h2>Accès discret</h2><p>Masqué retire le bouton de l’accueil et bloque l’adresse aux citoyens. La Direction conserve l’accès de préparation.</p></div></div>
          <form action={saveCasinoSettings} className="tombola-settings-form">
            <label><span>Visibilité</span><select name="public_enabled" defaultValue={settings.publicEnabled ? "true" : "false"}><option value="false">Masqué — privé Direction</option><option value="true">Visible — ouvert aux citoyens</option></select></label>
            <label><span>Nom du casino</span><input name="name" defaultValue={settings.name} maxLength={80} required /></label>
            <label><span>Sous-titre</span><input name="subtitle" defaultValue={settings.subtitle} maxLength={120} /></label>
            <label><span>Valeur RP d’un jeton ($RP)</span><input name="rp_per_chip" type="number" min="1" defaultValue={settings.rpPerChip} required /></label>
            <label><span>Conversion minimum (jetons)</span><input name="min_conversion" type="number" min="1" defaultValue={settings.minConversion} required /></label>
            <label><span>Conversion maximum (jetons)</span><input name="max_conversion" type="number" min="1" defaultValue={settings.maxConversion} required /></label>
            <label><span>Revente des jetons</span><select name="cashout_enabled" defaultValue={settings.cashoutEnabled ? "true" : "false"}><option value="true">Ouverte — crédit automatique en jeu</option><option value="false">Fermée — revente bloquée</option></select></label>
            <label><span>Commission maison à la revente (%)</span><input name="cashout_commission_percent" type="number" min="0" max="90" step="0.1" defaultValue={settings.cashoutCommissionPercent} required /></label>
            <label><span>Revente minimum (jetons)</span><input name="min_cashout" type="number" min="1" defaultValue={settings.minCashout} required /></label>
            <label><span>Revente maximum (jetons)</span><input name="max_cashout" type="number" min="1" defaultValue={settings.maxCashout} required /></label>
            <p className={styles.rateNote}>La revente est calculée sur le taux officiel puis la commission est retirée. Exemple : 100 jetons × {n(settings.rpPerChip)} $RP avec {settings.cashoutCommissionPercent.toLocaleString("fr-FR")} % de commission = {n(Math.floor(100 * settings.rpPerChip * (100 - settings.cashoutCommissionPercent) / 100))} $RP reversés.</p>
            <button className="btn" type="submit">Enregistrer les réglages</button>
          </form>
          <Link className="secondary-link-button" href="/casino">Prévisualiser le casino →</Link>
        </article>

        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">◈</span><div><h2>Packs de la caisse</h2><p>Configure les offres visibles sur le comptoir : nombre de jetons, bonus et ordre d’affichage.</p></div></div>
          <div className={styles.cashierPackageAdminGrid}>
            {cashierPackages.map((item) => (
              <div className={styles.cashierPackageAdminCard} key={item.id}>
                <form action={saveCasinoCashierPackage} className="tombola-settings-form">
                  <input type="hidden" name="id" value={item.id} />
                  <label><span>Nom du pack</span><input name="name" defaultValue={item.name} maxLength={60} required /></label>
                  <label><span>Jetons de base</span><input name="chip_amount" type="number" min="1" step="1" defaultValue={item.chipAmount} required /></label>
                  <label><span>Bonus (%)</span><input name="bonus_percent" type="number" min="0" max="100" step="0.1" defaultValue={item.bonusPercent} required /></label>
                  <label><span>Ordre</span><input name="sort_order" type="number" min="0" max="999" step="1" defaultValue={item.sortOrder} required /></label>
                  <label><span>Visibilité</span><select name="enabled" defaultValue={item.enabled ? "true" : "false"}><option value="true">Actif</option><option value="false">Masqué</option></select></label>
                  <p className={styles.packagePreview}>{n(item.chipAmount * settings.rpPerChip)} $RP → <strong>{n(item.chipAmount + Math.floor(item.chipAmount * item.bonusPercent / 100))} jetons</strong></p>
                  <button className="btn" type="submit">Enregistrer le pack</button>
                </form>
                <form action={deleteCasinoCashierPackage} className={styles.packageDeleteForm}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit">Supprimer le pack</button>
                </form>
              </div>
            ))}
            <form action={saveCasinoCashierPackage} className={`${styles.cashierPackageAdminCard} tombola-settings-form`}>
              <strong className={styles.newPackageTitle}>+ Nouveau pack</strong>
              <label><span>Nom du pack</span><input name="name" placeholder="Ex. Prestige" maxLength={60} required /></label>
              <label><span>Jetons de base</span><input name="chip_amount" type="number" min="1" step="1" defaultValue="500" required /></label>
              <label><span>Bonus (%)</span><input name="bonus_percent" type="number" min="0" max="100" step="0.1" defaultValue="0" required /></label>
              <label><span>Ordre</span><input name="sort_order" type="number" min="0" max="999" step="1" defaultValue={cashierPackages.length * 10 + 10} required /></label>
              <label><span>Visibilité</span><select name="enabled" defaultValue="true"><option value="true">Actif</option><option value="false">Masqué</option></select></label>
              <button className="btn" type="submit">Créer le pack</button>
            </form>
          </div>
        </article>

        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">◉</span><div><h2>Ajustement manuel</h2><p>Crédite ou retire des jetons à un citoyen. Chaque mouvement est enregistré dans le journal du casino.</p></div></div>
          <form action={adjustCasinoWallet} className="tombola-settings-form">
            <label><span>Citoyen</span><select name="user_id" required><option value="">Choisir un compte</option>{admin.citizens.map((citizen) => { const wallet = walletByUser.get(citizen.userId); return <option value={citizen.userId} key={citizen.userId}>{citizen.displayName} · {n(wallet?.balance ?? 0)} jetons</option>; })}</select></label>
            <label><span>Montant (+ pour créditer, − pour retirer)</span><input name="amount" type="number" step="1" required /></label>
            <label><span>Motif obligatoire</span><input name="reason" maxLength={180} placeholder="Correction, gain événement, remboursement…" required /></label>
            <button className="btn" type="submit">Enregistrer le mouvement</button>
          </form>
        </article>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">💶</span><div><h2>Achats avec l’argent RP</h2><p>Le débit sur le compte du serveur et le crédit des jetons sont maintenant automatiques. Aucun jeton n’est créé si le paiement RP échoue.</p></div></div>
        <div className="orders-list">
          {recentPurchases.length === 0 && <p className="empty-state">Aucun achat enregistré pour le moment.</p>}
          {recentPurchases.map((item) => (
            <article className="order-card" key={item.id}>
              <div><span className="module-status">{item.status === "approved" ? "PAYÉ" : item.status === "rejected" ? "REFUSÉ" : item.status === "cancelled" ? "ANNULÉ" : "À VÉRIFIER"}</span><h3>{item.citizenName}</h3><p>{n(item.rpAmount)} $RP → <strong>{n(item.chipAmount)} jetons</strong></p><small>{new Date(item.createdAt).toLocaleString("fr-FR")}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">↗</span><div><h2>Reventes vers le compte en jeu</h2><p>Les jetons retirés et les virements RP vers le compte bancaire principal sont enregistrés ici.</p></div></div>
        <div className="orders-list">
          {recentCashouts.length === 0 && <p className="empty-state">Aucune revente enregistrée pour le moment.</p>}
          {recentCashouts.map((item) => (
            <article className="order-card" key={item.id}>
              <div><span className="module-status">{item.status === "approved" ? "CRÉDITÉ" : item.status === "rejected" ? "REMBOURSÉ" : item.status === "cancelled" ? "ANNULÉ" : "EN COURS"}</span><h3>{item.citizenName}</h3><p><strong>{n(item.chipAmount)} jetons</strong> → {n(item.rpAmount)} $RP</p><small>{new Date(item.createdAt).toLocaleString("fr-FR")}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">⌁</span><div><h2>Dernières parties contrôlées</h2><p>Les mises, gains, remboursements et parties en cours sont visibles ici pour surveiller le fonctionnement réel du Casino.</p></div></div>
        <div className={styles.roundsTable}>
          {admin.recentRounds.length === 0 && <p className="empty-state">Aucune partie enregistrée pour le moment.</p>}
          {admin.recentRounds.map((round) => (
            <article key={round.id}>
              <span className={styles.roundGame}>{GAME_LABELS[round.game]?.icon} {GAME_LABELS[round.game]?.label}</span>
              <strong>{round.citizenName}</strong>
              <span>Mise {n(round.wager)}</span>
              <span className={round.payout > round.wager ? styles.profitText : round.payout === round.wager ? styles.neutralText : styles.lossText}>Gain {n(round.payout)}</span>
              <small>{new Date(round.createdAt).toLocaleString("fr-FR")}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="backoffice-panel">
        <div className="panel-heading"><span className="panel-icon">👤</span><div><h2>Portefeuilles joueurs</h2><p>Vue complète des soldes et de l’activité du Cercle.</p></div></div>
        <div className="tombola-ticket-table">
          {admin.wallets.length === 0 && <p className="empty-state">Les comptes apparaîtront à la première ouverture du casino.</p>}
          {admin.wallets.map((wallet) => (
            <article key={wallet.userId}>
              <strong>{wallet.displayName}</strong>
              <span>{n(wallet.balance)} jetons · niveau {wallet.level}</span>
              <small>{n(wallet.gamesPlayed)} parties · record {n(wallet.biggestWin)} · {n(wallet.xp)} XP</small>
              <details className="tombola-reset-confirmation">
                <summary className="danger-link-button">Réinitialiser ce joueur</summary>
                <div className="order-actions">
                  <form action={resetCasinoPlayer}><input type="hidden" name="user_id" value={wallet.userId} /><input type="hidden" name="scope" value="balance" /><input type="hidden" name="confirmation" value="REMETTRE LE SOLDE A ZERO" /><p>Retire tous les jetons, sans effacer le niveau ni les statistiques.</p><button className="danger-link-button" type="submit">Solde à zéro</button></form>
                  <form action={resetCasinoPlayer}><input type="hidden" name="user_id" value={wallet.userId} /><input type="hidden" name="scope" value="level" /><input type="hidden" name="confirmation" value="REMETTRE LE NIVEAU A ZERO" /><p>Remet uniquement l’XP à zéro et le joueur au niveau 1.</p><button className="danger-link-button" type="submit">Niveau à zéro</button></form>
                  <form action={resetCasinoPlayer}><input type="hidden" name="user_id" value={wallet.userId} /><input type="hidden" name="scope" value="total" /><input type="hidden" name="confirmation" value="REINITIALISER LE JOUEUR" /><p>Efface le solde, l’XP et toutes les statistiques Casino du joueur.</p><button className="danger-link-button" type="submit">Réinitialisation totale</button></form>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
