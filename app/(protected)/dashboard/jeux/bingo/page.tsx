import { clearBingoDraws, resetBingo, setBingoPhase, updateBingoSettings } from "@/app/actions/bingo";
import { BingoLiveGame } from "@/components/games/bingo-live-game";
import { BingoCard } from "@/components/games/bingo-card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getActiveBingoRound,
  getBingoCards,
  getBingoDraws,
  getBingoModuleConfigured,
  getBingoPurchases,
  getBingoWinners,
} from "@/lib/backoffice/data";
import { BINGO_SETUP_SQL } from "@/lib/backoffice/bingo-setup-sql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const phaseLabels: Record<string, string> = {
  one_line: "1 ligne",
  two_lines: "2 lignes",
  three_lines: "3 lignes",
  four_lines: "4 lignes",
  full_card: "Carton plein",
};

function money(value: number) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function BingoDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; phase?: string; cleared?: string; reset?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = await getBingoModuleConfigured();
  const round = configured ? await getActiveBingoRound() : null;
  const [cards, purchases, draws, winners] = round
    ? await Promise.all([
        getBingoCards(round.id),
        getBingoPurchases(round.id),
        getBingoDraws(round.id),
        getBingoWinners(round.id),
      ])
    : [[], [], [], []];

  const participants = new Set(cards.map((card) => card.user_id)).size;
  const revenue = purchases.reduce((total, purchase) => total + Number(purchase.total), 0);
  const activeWinners = round ? winners.filter((winner) => winner.phase === round.phase) : [];
  const calledNumbers = draws.map((draw) => draw.ball_number);

  const errorMessage = params.error === "complete"
    ? "Le carton plein a déjà été remporté."
    : params.error === "empty"
      ? "Aucun numéro supplémentaire ne peut être tiré."
      : params.error === "setup"
        ? "Le Bingo doit d’abord être activé dans Supabase."
        : params.error
          ? "L’opération n’a pas pu être enregistrée."
          : null;

  return (
    <DashboardShell>
      <DashboardHeader eyebrow="JEUX NOSTRA GROUP" title="Gestion du Bingo" description="Configure les ventes, sors les numéros en direct, contrôle automatiquement toutes les grilles et avance de 1 ligne jusqu’au carton plein." />

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation V32 nécessaire</span>
          <h2>Activer le Bingo complet</h2>
          <p>Exécute ce code une seule fois dans Supabase → SQL Editor → New query.</p>
          <details><summary>Afficher le code SQL V32</summary><pre>{BINGO_SETUP_SQL}</pre></details>
        </section>
      )}

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">Les paramètres du Bingo sont enregistrés.</div>}
      {params.phase && <div className="dashboard-feedback dashboard-feedback-success">L’objectif de la partie a été modifié.</div>}
      {params.cleared && <div className="dashboard-feedback dashboard-feedback-success">Les numéros sortis ont été effacés. Les citoyens conservent leurs grilles.</div>}
      {params.reset && <div className="dashboard-feedback dashboard-feedback-success">Le Bingo a été entièrement réinitialisé. Les anciennes grilles ne sont plus actives.</div>}
      {errorMessage && <div className="dashboard-feedback dashboard-feedback-error">{errorMessage}</div>}

      {configured && round && (
        <>
          <section className="dashboard-kpi-grid bingo-dashboard-kpis">
            <article><span>Grilles vendues</span><strong>{cards.length}</strong></article>
            <article><span>Participants</span><strong>{participants}</strong></article>
            <article><span>Recette totale</span><strong>{money(revenue)}</strong></article>
            <article><span>Numéros sortis</span><strong>{draws.length}/75</strong></article>
            <article><span>Bingo pour {phaseLabels[round.phase]}</span><strong>{activeWinners.length}</strong></article>
          </section>

          <section className="bingo-dashboard-controls">
            <article className="backoffice-panel">
              <div className="panel-heading"><span className="panel-icon">⚙️</span><div><h2>Paramètres et vente</h2><p>Le prix est repris automatiquement dans le panier du citoyen.</p></div></div>
              <form action={updateBingoSettings} className="bingo-settings-form">
                <label><span>Nom du Bingo</span><input name="title" defaultValue={round.title} required maxLength={120} /></label>
                <label><span>Prix d’une grille (€)</span><input name="card_price" type="number" min="0" step="0.01" defaultValue={round.card_price} required /></label>
                <label><span>Vente des grilles</span><select name="status" defaultValue={round.status === "open" ? "open" : "closed"}><option value="open">Ouverte</option><option value="closed">Fermée</option></select></label>
                <button className="btn" type="submit">Enregistrer</button>
              </form>
            </article>

            <article className="backoffice-panel">
              <div className="panel-heading"><span className="panel-icon">🏁</span><div><h2>Objectif de la partie</h2><p>Les numéros restent actifs lorsque tu passes de 1 ligne à 2, 3, 4 lignes puis au carton plein.</p></div></div>
              <form action={setBingoPhase} className="bingo-phase-form">
                <label><span>Objectif actuel</span><select name="phase" defaultValue={round.phase}><option value="one_line">1 ligne</option><option value="two_lines">2 lignes</option><option value="three_lines">3 lignes</option><option value="four_lines">4 lignes</option><option value="full_card">Carton plein</option></select></label>
                <button className="btn" type="submit">Lancer cet objectif</button>
              </form>
              <div className="bingo-danger-actions">
                <details><summary className="danger-link-button">Clear les numéros sortis</summary><form action={clearBingoDraws}><input type="hidden" name="confirmation" value="CLEAR_BINGO_NUMBERS" /><p>Les tirages et les Bingo détectés sont effacés, mais les citoyens gardent leurs grilles.</p><button className="danger-link-button" type="submit">Oui, effacer uniquement les numéros</button></form></details>
                <details><summary className="danger-link-button">Reset complet du Bingo</summary><form action={resetBingo}><input type="hidden" name="confirmation" value="RESET_BINGO" /><p>Cette action archive l’édition, les citoyens perdent leurs grilles et une nouvelle édition est créée.</p><button className="danger-link-button" type="submit">Oui, réinitialiser entièrement</button></form></details>
              </div>
            </article>
          </section>

          <BingoLiveGame roundId={round.id} phase={round.phase} status={round.status} initialDraws={draws} initialWinners={winners} cards={[]} manager showCardsSection={false} />

          <section className="backoffice-panel bingo-dashboard-winners-panel">
            <div className="panel-heading"><span className="panel-icon">🏆</span><div><h2>Bingo détectés automatiquement</h2><p>Le numéro de grille et le nom du propriétaire sont publiés sur la page publique.</p></div></div>
            <div className="bingo-dashboard-winners">
              {winners.length === 0 && <p className="empty-state">Aucun Bingo détecté pour le moment.</p>}
              {winners.map((winner) => <article key={winner.id}><span>{phaseLabels[winner.phase] ?? winner.phase}</span><strong>BG-{String(winner.card_number).padStart(5, "0")}</strong><small>{winner.customer_name}{winner.trigger_ball ? ` · déclenché par le n° ${winner.trigger_ball}` : ""}</small></article>)}
            </div>
          </section>

          <section className="backoffice-panel">
            <div className="panel-heading"><span className="panel-icon">▦</span><div><h2>Grilles vendues</h2><p>Toutes les grilles sont colorées automatiquement selon les numéros sortis.</p></div></div>
            <div className="bingo-cards-grid bingo-dashboard-cards">
              {cards.length === 0 && <p className="empty-state">Aucune grille vendue.</p>}
              {cards.map((card) => <BingoCard key={card.id} card={card} calledNumbers={calledNumbers} showOwner />)}
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
