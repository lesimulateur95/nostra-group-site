"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CasinoGameKey, CasinoGameSettings } from "@/lib/casino/types";
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
  poker: { kicker: "SALLE SIGNATURE · TABLE 01", title: "Texas Hold’em", text: "Prends place sur le velours vert, observe les adversaires et choisis le moment juste pour pousser tes jetons." },
  blackjack: { kicker: "SALON VINGT-ET-UN", title: "Blackjack", text: "Face au croupier de la Maison, approche 21 sans le dépasser. Chaque carte est distribuée et conservée côté serveur." },
  roulette: { kicker: "ROULETTE EUROPÉENNE", title: "La Grande Roue", text: "Mise sur une couleur, une chance simple ou un numéro plein avant que la bille ne quitte la piste." },
  slots: { kicker: "GALERIE DES JACKPOTS", title: "L’Impériale", text: "Trois rouleaux mécaniques, des combinaisons rares et un plafond de gain contrôlé par la Maison." },
  dice: { kicker: "TABLE DES HAUTS & BAS", title: "Le Sort des dés", text: "Annonce moins ou plus de cinquante, puis laisse les deux dés numériques décider." },
  plinko: { kicker: "SALLE DES MULTIPLICATEURS", title: "La Chute dorée", text: "Choisis ton risque, lâche la bille et suis sa trajectoire entre les clous jusqu’à la case finale." },
  coinflip: { kicker: "DUEL 50 / 50", title: "Le Louis d’or", text: "Pile ou face. Une seule décision, un lancer et le verdict de la pièce du Cercle." },
};

const CHOICES: Partial<Record<CasinoGameKey, Array<{ value: string; label: string }>>> = {
  roulette: [
    { value: "red", label: "Rouge" }, { value: "black", label: "Noir" },
    { value: "even", label: "Pair" }, { value: "odd", label: "Impair" },
    { value: "low", label: "1–18" }, { value: "high", label: "19–36" },
    { value: "green", label: "Zéro" },
  ],
  dice: [{ value: "under", label: "Moins de 50" }, { value: "over", label: "50 ou plus" }],
  plinko: [{ value: "low", label: "Risque faible" }, { value: "medium", label: "Risque moyen" }, { value: "high", label: "Risque élevé" }],
  coinflip: [{ value: "heads", label: "Pile" }, { value: "tails", label: "Face" }],
};

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const DIFFICULTY_LABEL = { balanced: "Table équilibrée", hard: "Table difficile", expert: "Table haute difficulté", custom: "Règles de la Maison" } as const;

function cardLabel(rank: number): string { return rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank); }
function chips(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

function PlayingCard({ card, hidden = false }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) return <span className={`${styles.playingCard} ${styles.cardBack}`}><i>CN</i></span>;
  const red = card.suit === "♥" || card.suit === "♦";
  return <span className={`${styles.playingCard} ${red ? styles.redCard : ""}`}><b>{cardLabel(card.rank)}</b><em>{card.suit}</em><small>{cardLabel(card.rank)}{card.suit}</small></span>;
}

function ChoiceButtons({ choices, choice, setChoice }: { choices: Array<{ value: string; label: string }>; choice: string; setChoice: (choice: string) => void }) {
  return <div className={styles.choiceGrid}>{choices.map((item) => <button type="button" className={`${styles.choiceButton} ${choice === item.value ? styles.choiceActive : ""}`} onClick={() => setChoice(item.value)} key={item.value}>{item.label}</button>)}</div>;
}

export function CasinoGame({ game, initialBalance, settings }: { game: CasinoGameKey; initialBalance: number; settings: CasinoGameSettings }) {
  const copy = GAME_COPY[game];
  const choices = CHOICES[game] ?? [];
  const [wager, setWager] = useState(settings.minBet);
  const [choice, setChoice] = useState(choices[0]?.value ?? "");
  const [balance, setBalance] = useState(initialBalance);
  const [result, setResult] = useState<GameResponse | null>(null);
  const [active, setActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const canPlay = settings.enabled && wager >= settings.minBet && wager <= settings.maxBet && wager <= balance && (!choices.length || Boolean(choice));

  const resultClass = useMemo(() => {
    if (!result || result.error) return "";
    return Number(result.payout ?? 0) > wager ? styles.resultWin : Number(result.payout ?? 0) === wager ? styles.resultPush : styles.resultLoss;
  }, [result, wager]);

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
  const net = Number(result?.payout ?? 0) - wager;

  return (
    <>
      <section className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>{copy.kicker}</p><h1>{copy.title}</h1></div>
        <div className={styles.tableIntro}><p>{copy.text}</p><span>{settings.enabled ? "● TABLE OUVERTE" : "● TABLE FERMÉE"}</span><small>{DIFFICULTY_LABEL[settings.difficulty]}</small></div>
      </section>

      <div className={styles.gameLayout}>
        <section className={`${styles.gameSurface} ${styles[`surface_${game}`]}`}>
          <div className={styles.tableLights} aria-hidden="true" />
          {!settings.enabled && <div className={styles.closedTable}><span>FERMÉ</span><h2>Cette salle est momentanément inaccessible</h2><p>La Direction du Cercle prépare la prochaine ouverture.</p></div>}

          {settings.enabled && game === "roulette" && (
            <div className={styles.rouletteRoom}>
              <div className={styles.rouletteStage}>
                <span className={styles.roulettePointer} />
                {typeof result?.number === "number" && <span className={styles.rouletteResult}>{result.number}</span>}
                <div className={`${styles.rouletteWheel} ${pending ? styles.wheelSpinning : ""}`} style={{ transform: result ? `rotate(${720 + (result.number ?? 0) * 9.7}deg)` : undefined }}><span className={styles.rouletteBall} /></div>
              </div>
              <div className={styles.rouletteBettingTable}>
                <div className={styles.rouletteNumbers}>
                  {Array.from({ length: 37 }, (_, number) => <button key={number} type="button" onClick={() => setChoice(number === 0 ? "green" : `number:${number}`)} className={`${number === 0 ? styles.numberGreen : RED_NUMBERS.has(number) ? styles.numberRed : styles.numberBlack} ${choice === (number === 0 ? "green" : `number:${number}`) ? styles.numberSelected : ""}`}>{number}</button>)}
                </div>
                <ChoiceButtons choices={choices} choice={choice} setChoice={setChoice} />
                <button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">{pending ? "La roue tourne…" : `Lancer la bille · ${chips(wager)} jetons`}</button>
              </div>
            </div>
          )}

          {settings.enabled && game === "slots" && (
            <div className={styles.slotRoom}>
              <div className={styles.slotMachine}>
                <div className={styles.slotMarquee}><small>LE CERCLE PRÉSENTE</small><strong>L’IMPÉRIALE</strong><span>JACKPOT ×{settings.jackpotMultiplier}</span></div>
                <div className={styles.slotBulbs} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
                <div className={styles.slotWindow}><div className={styles.slotPayline} />
                  <div className={styles.slotReels}>{(result?.symbols ?? ["◆", "♠", "✦"]).map((symbol, index) => <div className={`${styles.slotReel} ${pending ? styles.reelSpinning : ""}`} key={`${symbol}-${index}`}>{symbol}</div>)}</div>
                </div>
                <div className={styles.slotConsole}><span>MISE <b>{chips(wager)}</b></span><button className={styles.slotSpin} disabled={pending || !canPlay} onClick={simplePlay} type="button">{pending ? "EN COURS" : "JOUER"}</button><span>MAX <b>{chips(settings.maxPayout)}</b></span></div>
                <span className={styles.slotLever} aria-hidden="true"><i /></span>
              </div>
            </div>
          )}

          {settings.enabled && game === "blackjack" && (
            <div className={styles.blackjackRoom}>
              <div className={styles.blackjackTable}>
                <div className={styles.dealerRail}><span>LE CERCLE NOSTRA</span><small>CROUPIER · RESTE À 17</small></div>
                <div className={`${styles.hand} ${styles.dealerHand}`}><span className={styles.handLabel}>MAIN DU CROUPIER · {result?.dealerValue ?? "—"}</span>{result?.dealer?.length ? result.dealer.map((card, index) => <PlayingCard card={card} key={`d-${index}`} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
                <div className={styles.blackjackMark}>BLACKJACK<br /><small>PAIE SELON LES RÈGLES DE LA MAISON</small></div>
                <div className={`${styles.hand} ${styles.playerHand}`}><span className={styles.handLabel}>TA MAIN · {result?.playerValue ?? "—"}</span>{result?.player?.length ? result.player.map((card, index) => <PlayingCard card={card} key={`p-${index}`} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
                <div className={styles.betCircle}><span>{active ? "EN JEU" : chips(wager)}</span><small>JETONS</small></div>
              </div>
              <div className={styles.gameActions}>{!active ? <button className={styles.goldButton} disabled={pending || !canPlay} onClick={() => request("start")} type="button">Distribuer les cartes · {chips(wager)}</button> : <><button className={styles.secondaryButton} disabled={pending} onClick={() => request("hit")} type="button">Tirer une carte</button><button className={styles.goldButton} disabled={pending} onClick={() => request("stand")} type="button">Rester</button></>}</div>
            </div>
          )}

          {settings.enabled && game === "poker" && (
            <div className={styles.pokerRoom}>
              <div className={styles.pokerFelt}>
                <div className={styles.feltLogo}>LE CERCLE<small>TABLE PRIVÉE</small></div>
                {(result?.poker?.bots ?? [{ name: "La Marquise", folded: false, cards: [] }, { name: "Vega", folded: false, cards: [] }, { name: "Le Baron", folded: false, cards: [] }]).map((bot) => <span className={`${styles.seat} ${bot.folded ? styles.seatFolded : ""}`} key={bot.name}><i>{bot.name.slice(0, 1)}</i><strong>{bot.name}</strong><small>{bot.folded ? "COUCHÉ" : bot.cards.length ? bot.cards.map((card) => `${cardLabel(card.rank)}${card.suit}`).join("  ") : "EN JEU"}</small></span>)}
                <span className={`${styles.seat} ${styles.playerSeat}`}><i>TOI</i><strong>JOUEUR</strong><small>{result?.poker?.phase ?? "PRÊT"}</small></span>
                <div className={styles.community}>{(result?.poker?.board ?? []).map((card, index) => <PlayingCard card={card} key={`b-${index}`} />)}</div>
                <span className={styles.pokerPot}>POT <b>{chips(result?.poker?.pot ?? Math.trunc(wager * settings.baseMultiplier))}</b></span>
                <div className={styles.chipStack} aria-hidden="true"><i /><i /><i /></div>
                <div className={styles.playerCards}>{result?.poker?.player?.length ? result.poker.player.map((card, index) => <PlayingCard card={card} key={`h-${index}`} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
              </div>
              <div className={styles.gameActions}>{!active ? <button className={styles.goldButton} disabled={pending || !canPlay} onClick={() => request("start")} type="button">Prendre place · {chips(wager)} jetons</button> : <><button className={styles.dangerButton} disabled={pending} onClick={() => request("fold")} type="button">Se coucher</button><button className={styles.secondaryButton} disabled={pending} onClick={() => request("check")} type="button">Parole / Suivre</button><button className={styles.goldButton} disabled={pending} onClick={() => request("raise")} type="button">Relancer</button></>}</div>
            </div>
          )}

          {settings.enabled && game === "dice" && (
            <div className={styles.diceRoom}>
              <div className={styles.diceTable}><span className={styles.diceCup} /><div className={`${styles.die} ${pending ? styles.dieRolling : ""}`}>{typeof result?.number === "number" ? Math.floor(result.number / 10) : "•"}</div><div className={`${styles.die} ${pending ? styles.dieRolling : ""}`}>{typeof result?.number === "number" ? result.number % 10 : "•"}</div><span className={styles.diceTotal}>TOTAL <b>{result?.number ?? "—"}</b></span></div>
              <ChoiceButtons choices={choices} choice={choice} setChoice={setChoice} />
              <button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">{pending ? "Les dés roulent…" : `Lancer · ${chips(wager)} jetons`}</button>
            </div>
          )}

          {settings.enabled && game === "plinko" && (
            <div className={styles.plinkoRoom}>
              <div className={styles.plinkoBoard}>
                <span className={`${styles.plinkoBall} ${pending ? styles.ballDropping : ""}`} style={typeof result?.number === "number" ? { left: `${12 + result.number * 9.5}%` } : undefined} />
                <div className={styles.plinkoPegs}>{Array.from({ length: 66 }, (_, index) => <i key={index} />)}</div>
                <div className={styles.plinkoSlots}>{[settings.jackpotMultiplier, .5, settings.baseMultiplier, 0, settings.baseMultiplier, .5, settings.jackpotMultiplier].map((multiplier, index) => <span key={index}>×{multiplier}</span>)}</div>
              </div>
              <ChoiceButtons choices={choices} choice={choice} setChoice={setChoice} />
              <button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">{pending ? "La bille descend…" : `Lâcher la bille · ${chips(wager)} jetons`}</button>
            </div>
          )}

          {settings.enabled && game === "coinflip" && (
            <div className={styles.coinRoom}>
              <div className={styles.coinPedestal}><div className={`${styles.casinoCoin} ${pending ? styles.coinFlipping : ""} ${result?.outcome === "tails" ? styles.coinTails : ""}`}><span>CN</span><em>LE CERCLE</em></div></div>
              <ChoiceButtons choices={choices} choice={choice} setChoice={setChoice} />
              <button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">{pending ? "La pièce est en l’air…" : `Lancer la pièce · ${chips(wager)} jetons`}</button>
            </div>
          )}

          {result && (result.error || result.finished !== false) && <div className={`${styles.resultBox} ${result.error ? styles.error : resultClass}`}><small>{result.error ? "ACTION REFUSÉE" : "RÉSULTAT DE LA TABLE"}</small><strong>{result.error ?? result.result ?? (net > 0 ? "Gagné" : "Perdu")}</strong>{!result.error && <span>{net > 0 ? `Bénéfice +${chips(net)} · ${chips(Number(result.payout))} versés` : net === 0 ? "Mise rendue · égalité" : `${chips(Math.abs(net))} jetons perdus`}</span>}</div>}
        </section>

        <aside className={styles.gameSidebar}>
          <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.eyebrow}>TON PORTEFEUILLE</p><h3>{chips(balance)} jetons</h3></div><span className={styles.chipIcon}>◉</span></div><div className={styles.betControls}><div className={styles.field}><label htmlFor="casino-wager">Mise de la partie</label><input id="casino-wager" type="number" min={settings.minBet} max={Math.min(settings.maxBet, Math.max(settings.minBet, balance))} value={wager} disabled={active} onChange={(event) => setWager(Math.max(0, Math.trunc(Number(event.target.value))))} /></div><div className={styles.quickBets}><button disabled={active} onClick={() => setWager(settings.minBet)} type="button">MIN</button><button disabled={active} onClick={() => setWager(Math.min(settings.maxBet, Math.max(settings.minBet, Math.trunc(balance / 2))))} type="button">½</button><button disabled={active} onClick={() => setWager(Math.min(settings.maxBet, balance))} type="button">MAX</button></div><div className={styles.tableLimits}><span>Minimum <b>{chips(settings.minBet)}</b></span><span>Maximum <b>{chips(settings.maxBet)}</b></span><span>Plafond gain <b>{chips(settings.maxPayout)}</b></span></div></div></section>
          <section className={styles.panel}><p className={styles.eyebrow}>RÈGLES DE LA MAISON</p><p className={styles.responsibleCopy}>Les mises et résultats sont traités sur le serveur. Une partie interrompue est remboursée automatiquement après le délai de sécurité.</p></section>
        </aside>
      </div>
    </>
  );
}
