"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CasinoGameKey } from "@/lib/casino/types";
import styles from "./casino.module.css";

type Card = { rank: number; suit: string };
type PokerView = {
  phase: string;
  phaseIndex: number;
  wager: number;
  pot: number;
  player: Card[];
  board: Card[];
  bots: Array<{ name: string; folded: boolean; cards: Card[] }>;
};
type GameResponse = {
  error?: string;
  finished?: boolean;
  result?: string;
  payout?: number;
  balance?: number;
  outcome?: string;
  symbols?: string[];
  number?: number;
  multiplier?: number;
  player?: Card[];
  dealer?: Card[];
  playerValue?: number;
  dealerValue?: number;
  poker?: PokerView;
};

const GAME_COPY: Record<CasinoGameKey, { kicker: string; title: string; text: string }> = {
  poker: { kicker: "JEU SIGNATURE", title: "Texas Hold’em", text: "Entre à la table, lis le jeu et pousse tes jetons au bon moment." },
  blackjack: { kicker: "VINGT-ET-UN", title: "Blackjack", text: "Tire une carte ou reste. Le plus proche de 21 remporte la main." },
  roulette: { kicker: "LA BILLE DÉCIDE", title: "Roulette", text: "Choisis ta mise, observe la roue et laisse la bille parler." },
  slots: { kicker: "TIREZ LE LEVIER", title: "Machines à sous", text: "Aligne les symboles les plus rares pour décrocher le jackpot." },
  dice: { kicker: "LE SORT DES DÉS", title: "Dés", text: "Prédit si le résultat sera inférieur ou supérieur à cinquante." },
  plinko: { kicker: "LA BILLE TOMBE", title: "Plinko", text: "Choisis ton niveau de risque et suis la bille jusqu’au multiplicateur." },
  coinflip: { kicker: "50 / 50", title: "Pile ou face", text: "Une pièce, deux faces et un verdict instantané." },
};

const CHOICES: Partial<Record<CasinoGameKey, Array<{ value: string; label: string }>>> = {
  roulette: [
    { value: "red", label: "Rouge" }, { value: "black", label: "Noir" },
    { value: "even", label: "Pair" }, { value: "odd", label: "Impair" },
    { value: "low", label: "1–18" }, { value: "high", label: "19–36" },
    { value: "green", label: "Zéro" },
  ],
  dice: [{ value: "under", label: "Moins de 50" }, { value: "over", label: "Plus de 50" }],
  plinko: [{ value: "low", label: "Risque faible" }, { value: "medium", label: "Risque moyen" }, { value: "high", label: "Risque élevé" }],
  coinflip: [{ value: "heads", label: "Pile" }, { value: "tails", label: "Face" }],
};

function cardLabel(rank: number): string { return rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank); }
function chips(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

function PlayingCard({ card, hidden = false }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) return <span className={`${styles.playingCard} ${styles.cardBack}`}>N</span>;
  const red = card.suit === "♥" || card.suit === "♦";
  return <span className={`${styles.playingCard} ${red ? styles.redCard : ""}`}>{cardLabel(card.rank)}<em>{card.suit}</em></span>;
}

export function CasinoGame({ game, initialBalance }: { game: CasinoGameKey; initialBalance: number }) {
  const copy = GAME_COPY[game];
  const choices = CHOICES[game] ?? [];
  const [wager, setWager] = useState(100);
  const [choice, setChoice] = useState(choices[0]?.value ?? "");
  const [balance, setBalance] = useState(initialBalance);
  const [result, setResult] = useState<GameResponse | null>(null);
  const [active, setActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const canPlay = wager > 0 && wager <= balance && (!choices.length || Boolean(choice));

  const resultClass = useMemo(() => {
    if (!result || result.error) return "";
    return Number(result.payout ?? 0) > 0 ? styles.resultWin : styles.resultLoss;
  }, [result]);

  function request(action: string) {
    setResult((previous) => action === "start" || action === "play" ? null : previous);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, action, wager, choice }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as GameResponse;
      setResult(payload);
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (game === "blackjack" || game === "poker") setActive(response.ok && payload.finished !== true);
      if (response.ok && payload.finished !== false) router.refresh();
    });
  }

  const simplePlay = () => request("play");

  return (
    <>
      <section className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>{copy.kicker}</p><h1>{copy.title}</h1></div>
        <p>{copy.text}</p>
      </section>

      <div className={styles.gameLayout}>
        <section className={styles.gameSurface}>
          {game === "roulette" && (
            <>
              <div style={{ position: "relative" }}>
                {typeof result?.number === "number" && <span className={styles.rouletteResult}>{result.number}</span>}
                <div className={styles.rouletteWheel} style={{ transform: result ? `rotate(${720 + (result.number ?? 0) * 9.7}deg)` : undefined }} />
              </div>
              <div className={styles.choiceGrid}>{choices.map((item) => <button type="button" className={`${styles.choiceButton} ${choice === item.value ? styles.choiceActive : ""}`} onClick={() => setChoice(item.value)} key={item.value}>{item.label}</button>)}</div>
              <div className={styles.gameActions}><button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">Faire tourner · {chips(wager)} jetons</button></div>
            </>
          )}

          {game === "slots" && (
            <div className={styles.slotMachine}>
              <div className={styles.slotReels}>{(result?.symbols ?? ["◆", "♠", "✦"]).map((symbol, index) => <div className={styles.slotReel} key={`${symbol}-${index}`}>{symbol}</div>)}</div>
              <div className={styles.gameActions}><button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">{pending ? "Les rouleaux tournent…" : `Tourner · ${chips(wager)} jetons`}</button></div>
            </div>
          )}

          {game === "blackjack" && (
            <div className={styles.cardsArea}>
              <div className={styles.hand}><span className={styles.handLabel}>Croupier · {result?.dealerValue ?? 0}</span>{result?.dealer?.length ? result.dealer.map((card, index) => <PlayingCard card={card} key={`d-${index}`} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
              <div className={styles.hand}><span className={styles.handLabel}>Ta main · {result?.playerValue ?? 0}</span>{result?.player?.length ? result.player.map((card, index) => <PlayingCard card={card} key={`p-${index}`} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
              <div className={styles.gameActions}>
                {!active ? <button className={styles.goldButton} disabled={pending || !canPlay} onClick={() => request("start")} type="button">Distribuer · {chips(wager)} jetons</button> : <><button className={styles.secondaryButton} disabled={pending} onClick={() => request("hit")} type="button">Tirer</button><button className={styles.goldButton} disabled={pending} onClick={() => request("stand")} type="button">Rester</button></>}
              </div>
            </div>
          )}

          {game === "poker" && (
            <div className={styles.pokerRoom}>
              <div className={styles.pokerFelt}>
                {(result?.poker?.bots ?? [{ name: "La Marquise", folded: false, cards: [] }, { name: "Vega", folded: false, cards: [] }, { name: "Le Baron", folded: false, cards: [] }]).map((bot) => (
                  <span className={`${styles.seat} ${bot.folded ? styles.seatFolded : ""}`} key={bot.name}><strong>{bot.name}</strong><small>{bot.folded ? "Couché" : bot.cards.length ? bot.cards.map((card) => `${cardLabel(card.rank)}${card.suit}`).join(" ") : "En jeu"}</small></span>
                ))}
                <span className={styles.seat}><strong>TOI</strong><small>{result?.poker?.phase ?? "Prêt"}</small></span>
                <div className={styles.community}>{(result?.poker?.board ?? []).map((card, index) => <PlayingCard card={card} key={`b-${index}`} />)}</div>
                <span className={styles.pokerPot}>POT · {chips(result?.poker?.pot ?? wager * 4)} JETONS</span>
                <div className={styles.playerCards}>{result?.poker?.player?.length ? result.poker.player.map((card, index) => <PlayingCard card={card} key={`h-${index}`} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
              </div>
              <div className={styles.gameActions} style={{ marginTop: 70 }}>
                {!active ? <button className={styles.goldButton} disabled={pending || !canPlay} onClick={() => request("start")} type="button">Entrer en solo · {chips(wager)} jetons</button> : <><button className={styles.dangerButton} disabled={pending} onClick={() => request("fold")} type="button">Se coucher</button><button className={styles.secondaryButton} disabled={pending} onClick={() => request("check")} type="button">Parole / Suivre</button><button className={styles.goldButton} disabled={pending} onClick={() => request("raise")} type="button">Relancer</button></>}
              </div>
            </div>
          )}

          {["dice", "plinko", "coinflip"].includes(game) && (
            <div style={{ minHeight: 500, display: "grid", placeItems: "center", alignContent: "center", gap: 30 }}>
              <div style={{ width: 210, aspectRatio: 1, display: "grid", placeItems: "center", borderRadius: game === "coinflip" ? "50%" : "18px", border: "1px solid rgba(216,173,63,.45)", background: "radial-gradient(circle,rgba(216,173,63,.22),#0b100d 68%)", color: "#ffe096", font: "400 5rem Georgia,serif", boxShadow: "0 25px 70px #000" }}>
                {game === "dice" ? (result?.number ?? "⚄") : game === "plinko" ? (result?.multiplier ? `×${result.multiplier}` : "▽") : (result?.outcome === "heads" ? "P" : result?.outcome === "tails" ? "F" : "?")}
              </div>
              <div className={styles.choiceGrid} style={{ width: "min(100%,560px)" }}>{choices.map((item) => <button type="button" className={`${styles.choiceButton} ${choice === item.value ? styles.choiceActive : ""}`} onClick={() => setChoice(item.value)} key={item.value}>{item.label}</button>)}</div>
              <button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">Lancer · {chips(wager)} jetons</button>
            </div>
          )}

          {result && (result.error || result.finished !== false) && (
            <div className={`${styles.resultBox} ${result.error ? styles.error : resultClass}`}>
              <small>{result.error ? "ACTION REFUSÉE" : "RÉSULTAT"}</small>
              <strong>{result.error ?? result.result ?? (Number(result.payout) > 0 ? "Gagné" : "Perdu")}</strong>
              {!result.error && <span>{Number(result.payout) > 0 ? `+ ${chips(Number(result.payout))} jetons crédités` : "Aucun gain sur cette partie"}</span>}
            </div>
          )}
        </section>

        <aside className={styles.gameSidebar}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><p className={styles.eyebrow}>TON PORTEFEUILLE</p><h3>{chips(balance)} jetons</h3></div><span className={styles.chipIcon}>◉</span></div>
            <div className={styles.betControls}>
              <div className={styles.field}><label htmlFor="casino-wager">Mise</label><input id="casino-wager" type="number" min={1} max={Math.max(1, balance)} value={wager} disabled={active} onChange={(event) => setWager(Math.max(0, Math.trunc(Number(event.target.value))))} /></div>
              <div className={styles.quickBets}><button disabled={active} onClick={() => setWager(100)} type="button">100</button><button disabled={active} onClick={() => setWager(500)} type="button">500</button><button disabled={active} onClick={() => setWager(Math.max(1, Math.trunc(balance / 2)))} type="button">½</button></div>
            </div>
          </section>
          <section className={styles.panel}><p className={styles.eyebrow}>JEU RESPONSABLE</p><p style={{ color: "#858b84", fontSize: ".75rem", lineHeight: 1.6, margin: 0 }}>Les jetons sont une monnaie virtuelle RP. Fixe ta mise avant la partie ; aucun bouton ne pourra miser plus que ton solde.</p></section>
        </aside>
      </div>
    </>
  );
}
