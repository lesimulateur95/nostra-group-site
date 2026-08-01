"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CasinoGameKey, CasinoGameSettings } from "@/lib/casino/types";
import styles from "./casino.module.css";

type Card = { rank: number; suit: string };
type PokerView = {
  phase: string;
  phaseIndex: number;
  wager: number;
  pot: number;
  mainPot: number;
  sidePot: number;
  committed: number;
  toCall: number;
  minRaise: number;
  available: number;
  maxTotalBet: number;
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
  wager?: number;
  winningBets?: Array<{ choice: string; amount: number }>;
  player?: Card[];
  dealer?: Card[];
  playerValue?: number;
  dealerValue?: number;
  poker?: PokerView;
  active?: boolean;
  currentAmount?: number;
  doubles?: number;
};

const GAME_COPY: Record<CasinoGameKey, { kicker: string; title: string; text: string }> = {
  poker: { kicker: "SALLE SIGNATURE · TABLE 01", title: "Texas Hold’em", text: "Prends place sur le velours vert, observe les adversaires et choisis le moment juste pour pousser tes jetons." },
  blackjack: { kicker: "SALON VINGT-ET-UN", title: "Blackjack", text: "Face au croupier de la Maison, approche 21 sans le dépasser. Chaque carte est distribuée et conservée côté serveur." },
  roulette: { kicker: "ROULETTE EUROPÉENNE", title: "La Grande Roue", text: "Mise sur une couleur, une chance simple ou un numéro plein avant que la bille ne quitte la piste." },
  slots: { kicker: "GALERIE DES JACKPOTS", title: "L’Impériale", text: "Trois rouleaux mécaniques, des combinaisons rares et un plafond de gain contrôlé par la Maison." },
  dice: { kicker: "TABLE DES HAUTS & BAS", title: "Le Sort des dés", text: "Annonce moins ou plus de cinquante, puis laisse les deux dés numériques décider." },
  plinko: { kicker: "SALLE DES MULTIPLICATEURS", title: "La Chute dorée", text: "Choisis ton risque, lâche la bille et suis sa trajectoire entre les clous jusqu’à la case finale." },
  coinflip: { kicker: "DUEL 50 / 50", title: "Le Louis d’or", text: "Pile ou face. Une seule décision, un lancer et le verdict de la pièce du Cercle." },
  double_or_quit: { kicker: "SALON DU RISQUE", title: "Double ou quitte", text: "Tente de doubler la somme à chaque tour. Quitte la table quand tu le souhaites pour encaisser, mais un seul échec fait tout perdre." },
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
const ROULETTE_ROWS = [
  [3,6,9,12,15,18,21,24,27,30,33,36],
  [2,5,8,11,14,17,20,23,26,29,32,35],
  [1,4,7,10,13,16,19,22,25,28,31,34],
];
const POKER_HANDS = [
  ["Quinte flush royale", "A · K · Q · J · 10 assortis"], ["Quinte flush", "Cinq cartes assorties qui se suivent"],
  ["Carré", "Quatre cartes de même valeur"], ["Full", "Un brelan accompagné d’une paire"],
  ["Couleur", "Cinq cartes de la même couleur"], ["Suite", "Cinq valeurs consécutives"],
  ["Brelan", "Trois cartes de même valeur"], ["Deux paires", "Deux paires différentes"],
  ["Paire", "Deux cartes de même valeur"], ["Carte haute", "La plus haute carte départage"],
];
const DIFFICULTY_LABEL = { balanced: "Table équilibrée", hard: "Table difficile", expert: "Table haute difficulté", custom: "Règles de la Maison" } as const;

const SLOT_MACHINES = [
  { key: "imperiale", name: "L’Impériale", kicker: "GRAND CLASSIQUE", symbol: "♛", palette: "gold", symbols: ["◆", "♠", "✦", "7", "♛", "●"], text: "Boiseries, laiton et jackpots du Cercle." },
  { key: "neon", name: "Neon 777", kicker: "NUIT ÉLECTRIQUE", symbol: "7", palette: "neon", symbols: ["⚡", "7", "★", "◆", "●", "♣"], text: "Une machine lumineuse inspirée des casinos nocturnes." },
  { key: "pharaoh", name: "Trésor du Pharaon", kicker: "CHAMBRE D’OR", symbol: "☥", palette: "pharaoh", symbols: ["☥", "◈", "♛", "☀", "◆", "7"], text: "Hiéroglyphes, pierre noire et trésors antiques." },
  { key: "lucky", name: "Lucky Sevens", kicker: "ROUGE & CHROME", symbol: "777", palette: "lucky", symbols: ["7", "★", "♥", "♦", "♣", "♠"], text: "La machine rapide dédiée au mythique triple 7." },
  { key: "diamond", name: "Diamond Society", kicker: "SALON PRIVÉ", symbol: "◇", palette: "diamond", symbols: ["◇", "✦", "♛", "◆", "7", "●"], text: "Cristal, argent et lumière froide pour les hautes mises." },
  { key: "jungle", name: "Jungle Fortune", kicker: "ÉMERAUDE SAUVAGE", symbol: "✦", palette: "jungle", symbols: ["✦", "◆", "●", "♣", "♛", "7"], text: "Une machine végétale aux reflets d’émeraude." },
] as const;

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
  const [raiseAmount, setRaiseAmount] = useState(settings.minBet);
  const [rouletteChip, setRouletteChip] = useState(settings.minBet);
  const [rouletteBets, setRouletteBets] = useState<Record<string, number>>({});
  const [slotMachine, setSlotMachine] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const selectedSlot = SLOT_MACHINES.find((machine) => machine.key === slotMachine) ?? null;
  const rouletteTotal = Object.values(rouletteBets).reduce((sum, amount) => sum + amount, 0);
  const rouletteChips = useMemo(() => [...new Set([settings.minBet, settings.minBet * 5, settings.minBet * 10, settings.minBet * 25, settings.minBet * 100].filter((value) => value <= settings.maxBet))], [settings.minBet, settings.maxBet]);
  const canPlay = settings.enabled && (game === "roulette"
    ? rouletteTotal >= settings.minBet && rouletteTotal <= settings.maxBet && rouletteTotal <= balance
    : wager >= settings.minBet && wager <= settings.maxBet && wager <= balance && (!choices.length || Boolean(choice)));

  useEffect(() => {
    if ((game !== "double_or_quit" && game !== "poker") || !settings.enabled) return;
    let cancelled = false;
    void fetch("/api/casino/play", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game, action: "status", wager }),
    }).then((response) => response.json()).then((payload: GameResponse) => {
      if (cancelled || payload.error) return;
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (payload.active) {
        setResult(payload);
        setActive(true);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [game, settings.enabled, wager]);

  const resultClass = useMemo(() => {
    if (!result || result.error) return "";
    const comparedWager = Number(result.wager ?? result.poker?.committed ?? wager);
    return Number(result.payout ?? 0) > comparedWager ? styles.resultWin : Number(result.payout ?? 0) === comparedWager ? styles.resultPush : styles.resultLoss;
  }, [result, wager]);

  function placeRouletteBet(target: string) {
    if (pending || rouletteTotal + rouletteChip > Math.min(balance, settings.maxBet)) return;
    setResult(null);
    setRouletteBets((current) => ({ ...current, [target]: (current[target] ?? 0) + rouletteChip }));
  }

  function request(action: string, amount = 0) {
    setResult((previous) => action === "start" || action === "play" ? null : previous);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          game, action, wager: game === "roulette" ? rouletteTotal : wager,
          choice: game === "slots" ? selectedSlot?.key ?? "imperiale" : choice,
          doubles: Number(result?.doubles ?? 0), raiseAmount: amount,
          bets: game === "roulette" ? Object.entries(rouletteBets).map(([betChoice, betAmount]) => ({ choice: betChoice, amount: betAmount })) : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as GameResponse;
      setResult(payload);
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (response.ok && (game === "blackjack" || game === "poker" || game === "double_or_quit")) setActive(payload.finished !== true);
      if (response.ok && payload.finished !== false) router.refresh();
    });
  }

  const simplePlay = () => request("play");
  const resultWager = Number(result?.wager ?? wager);
  const net = Number(result?.payout ?? 0) - resultWager;

  return (
    <>
      <section className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>{selectedSlot?.kicker ?? copy.kicker}</p><h1>{selectedSlot?.name ?? copy.title}</h1></div>
        <div className={styles.tableIntro}><p>{selectedSlot?.text ?? copy.text}</p><span>{settings.enabled ? "● TABLE OUVERTE" : "● TABLE FERMÉE"}</span><small>{DIFFICULTY_LABEL[settings.difficulty]}</small></div>
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
                <div className={styles.rouletteChipRack}>
                  <span>VALEUR DU JETON</span>
                  {rouletteChips.map((chip) => <button className={rouletteChip === chip ? styles.rouletteChipActive : ""} onClick={() => setRouletteChip(chip)} type="button" key={chip}>{chips(chip)}</button>)}
                </div>
                <div className={styles.realRouletteGrid}>
                  <button type="button" className={`${styles.rouletteZero} ${rouletteBets["number:0"] ? styles.rouletteCellBet : ""}`} onClick={() => placeRouletteBet("number:0")}>0{rouletteBets["number:0"] ? <i>{chips(rouletteBets["number:0"])}</i> : null}</button>
                  <div className={styles.rouletteNumberMatrix}>{ROULETTE_ROWS.flat().map((number) => { const key=`number:${number}`; return <button key={number} type="button" onClick={() => placeRouletteBet(key)} className={`${RED_NUMBERS.has(number) ? styles.numberRed : styles.numberBlack} ${rouletteBets[key] ? styles.rouletteCellBet : ""}`}>{number}{rouletteBets[key] ? <i>{chips(rouletteBets[key])}</i> : null}</button>; })}</div>
                  <div className={styles.rouletteColumns}>{[1,2,3].map((column) => { const key=`column:${column}`; return <button type="button" onClick={() => placeRouletteBet(key)} key={key}>2 à 1{rouletteBets[key] ? <i>{chips(rouletteBets[key])}</i> : null}</button>; })}</div>
                </div>
                <div className={styles.rouletteDozens}>{[["dozen:1","1re douzaine"],["dozen:2","2e douzaine"],["dozen:3","3e douzaine"]].map(([key,label]) => <button type="button" onClick={() => placeRouletteBet(key)} key={key}>{label}{rouletteBets[key] ? <i>{chips(rouletteBets[key])}</i> : null}</button>)}</div>
                <div className={styles.rouletteOutside}>{[["low","1–18"],["even","PAIR"],["red","ROUGE"],["black","NOIR"],["odd","IMPAIR"],["high","19–36"]].map(([key,label]) => <button className={key === "red" ? styles.numberRed : key === "black" ? styles.numberBlack : ""} type="button" onClick={() => placeRouletteBet(key)} key={key}>{label}{rouletteBets[key] ? <i>{chips(rouletteBets[key])}</i> : null}</button>)}</div>
                <div className={styles.rouletteTicket}><span>{Object.keys(rouletteBets).length} emplacement(s)</span><strong>{chips(rouletteTotal)} jetons sur le tapis</strong><div><button type="button" disabled={pending || rouletteTotal === 0} onClick={() => setRouletteBets({})}>Retirer tous les jetons</button><button className={styles.goldButton} disabled={pending || !canPlay} onClick={simplePlay} type="button">{pending ? "La roue tourne…" : "Lancer la bille"}</button></div></div>
              </div>
            </div>
          )}

          {settings.enabled && game === "slots" && !selectedSlot && (
            <div className={styles.slotHall}>
              <div className={styles.slotHallHeading}><span>GALERIE DES JACKPOTS</span><h2>Choisis ta machine</h2><p>Six univers différents, un seul portefeuille de jetons et des résultats sécurisés côté serveur.</p></div>
              <div className={styles.slotCabinetGrid}>
                {SLOT_MACHINES.map((machine) => (
                  <button className={`${styles.slotCabinet} ${styles[`slotTheme_${machine.palette}`]}`} key={machine.key} type="button" onClick={() => { setSlotMachine(machine.key); setResult(null); }}>
                    <small>{machine.kicker}</small><strong>{machine.name}</strong><span>{machine.symbol}</span><p>{machine.text}</p><em>JOUER À CETTE MACHINE</em>
                  </button>
                ))}
              </div>
            </div>
          )}

          {settings.enabled && game === "slots" && selectedSlot && (
            <div className={styles.slotRoom}>
              <button className={styles.slotBackButton} type="button" onClick={() => { setSlotMachine(null); setResult(null); }}>← Revenir aux 6 machines</button>
              <div className={`${styles.slotMachine} ${styles[`slotTheme_${selectedSlot.palette}`]}`}>
                <div className={styles.slotMarquee}><small>{selectedSlot.kicker}</small><strong>{selectedSlot.name}</strong><span>JACKPOT ×{settings.jackpotMultiplier}</span></div>
                <div className={styles.slotBulbs} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
                <div className={styles.slotWindow}><div className={styles.slotPayline} />
                  <div className={styles.slotReels}>{(result?.symbols ?? ["◆", "♠", "✦"]).map((symbol, index) => {
                    const sourceIndex = ["◆", "♠", "✦", "7", "♛", "●"].indexOf(symbol);
                    const themedSymbol = selectedSlot.symbols[sourceIndex >= 0 ? sourceIndex : index % selectedSlot.symbols.length];
                    return <div className={`${styles.slotReel} ${pending ? styles.reelSpinning : ""}`} key={`${symbol}-${index}`}>{themedSymbol}</div>;
                  })}</div>
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
                <span className={styles.pokerPot}>POT PRINCIPAL <b>{chips(result?.poker?.mainPot ?? result?.poker?.pot ?? Math.trunc(wager * settings.baseMultiplier))}</b>{Boolean(result?.poker?.sidePot) && <small>POT SECONDAIRE {chips(Number(result?.poker?.sidePot))}</small>}</span>
                <div className={styles.chipStack} aria-hidden="true"><i /><i /><i /></div>
                <div className={styles.playerCards}>{result?.poker?.player?.length ? result.poker.player.map((card, index) => <PlayingCard card={card} key={`h-${index}`} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
              </div>
              {!active ? <div className={styles.gameActions}><button className={styles.goldButton} disabled={pending || !canPlay} onClick={() => request("start")} type="button">Prendre place · {chips(wager)} jetons</button></div> : <div className={styles.pokerBettingConsole}>
                <div className={styles.pokerBetStatus}><span>Déjà engagé <b>{chips(result?.poker?.committed ?? wager)}</b></span><span>À suivre <b>{chips(result?.poker?.toCall ?? 0)}</b></span><span>Disponible <b>{chips(result?.poker?.available ?? balance)}</b></span></div>
                <div className={styles.pokerRaiseControl}><label htmlFor="poker-raise">Montant de la relance</label><input id="poker-raise" type="number" min={result?.poker?.minRaise ?? 1} max={Math.max(result?.poker?.minRaise ?? 1, Math.min(result?.poker?.available ?? balance, (result?.poker?.maxTotalBet ?? settings.maxBet) - (result?.poker?.committed ?? wager)))} value={raiseAmount} onChange={(event) => setRaiseAmount(Math.max(0,Math.trunc(Number(event.target.value))))} /><small>Minimum {chips(result?.poker?.minRaise ?? 1)}</small></div>
                <div className={styles.gameActions}><button className={styles.dangerButton} disabled={pending} onClick={() => request("fold")} type="button">Se coucher</button><button className={styles.secondaryButton} disabled={pending || Number(result?.poker?.toCall ?? 0) > 0} onClick={() => request("check")} type="button">Parole</button><button className={styles.secondaryButton} disabled={pending || Number(result?.poker?.toCall ?? 0) === 0} onClick={() => request("call")} type="button">Suivre {chips(result?.poker?.toCall ?? 0)}</button><button className={styles.goldButton} disabled={pending || raiseAmount < Number(result?.poker?.minRaise ?? 1)} onClick={() => request("raise",raiseAmount)} type="button">Relancer de {chips(raiseAmount)}</button><button className={styles.allInButton} disabled={pending || Number(result?.poker?.available ?? 0) < 1} onClick={() => request("allin")} type="button">Tapis</button></div>
              </div>}
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

          {settings.enabled && game === "double_or_quit" && (
            <div className={styles.doubleRoom}>
              <div className={styles.doubleVault}>
                <span className={styles.doubleKicker}>{active ? "SOMME EN JEU" : "MISE DE DÉPART"}</span>
                <div className={`${styles.doubleAmount} ${pending ? styles.doublePulse : ""}`}>
                  <small>◉</small>
                  <strong>{chips(active ? Number(result?.currentAmount ?? wager) : wager)}</strong>
                  <span>JETONS</span>
                </div>
                <div className={styles.doubleProgress}>
                  {Array.from({ length: 6 }, (_, index) => <i className={index < Number(result?.doubles ?? 0) ? styles.doubleStepWon : ""} key={index}>×{2 ** (index + 1)}</i>)}
                </div>
                <p>{active ? `${Number(result?.doubles ?? 0)} double${Number(result?.doubles ?? 0) > 1 ? "s" : ""} réussi${Number(result?.doubles ?? 0) > 1 ? "s" : ""}. Tu peux encaisser maintenant ou tout risquer.` : "Lance la partie pour placer ta mise sur la table."}</p>
                {active && result?.finished === false && result.result && <strong className={styles.doubleMessage}>{result.result}</strong>}
              </div>
              <div className={styles.doubleActions}>
                {!active ? (
                  <button className={styles.goldButton} disabled={pending || !canPlay} onClick={() => request("start")} type="button">Commencer · {chips(wager)} jetons</button>
                ) : (
                  <>
                    <button className={styles.secondaryButton} disabled={pending} onClick={() => request("cashout")} type="button">Quitter et encaisser {chips(Number(result?.currentAmount ?? wager))}</button>
                    <button className={styles.doubleButton} disabled={pending} onClick={() => request("double")} type="button">{pending ? "Verdict…" : `Doubler vers ${chips(Math.min(settings.maxPayout, Number(result?.currentAmount ?? wager) * 2))}`}</button>
                  </>
                )}
              </div>
              <small className={styles.doubleDisclaimer}>Chaque tentative est indépendante. Un échec remet immédiatement le gain de la partie à zéro.</small>
            </div>
          )}

          {result && (result.error || result.finished !== false) && <div className={`${styles.resultBox} ${result.error ? styles.error : resultClass}`}><small>{result.error ? "ACTION REFUSÉE" : "RÉSULTAT DE LA TABLE"}</small><strong>{result.error ?? result.result ?? (net > 0 ? "Gagné" : "Perdu")}</strong>{!result.error && <span>{net > 0 ? `Bénéfice +${chips(net)} · ${chips(Number(result.payout))} versés` : net === 0 ? "Mise rendue · égalité" : `${chips(Math.abs(net))} jetons perdus`}</span>}</div>}
        </section>

        <aside className={styles.gameSidebar}>
          <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.eyebrow}>TON PORTEFEUILLE</p><h3>{chips(balance)} jetons</h3></div><span className={styles.chipIcon}>◉</span></div><div className={styles.betControls}>{game !== "roulette" && <><div className={styles.field}><label htmlFor="casino-wager">{game === "poker" ? "Mise d’entrée" : "Mise de la partie"}</label><input id="casino-wager" type="number" min={settings.minBet} max={Math.min(settings.maxBet, Math.max(settings.minBet, balance))} value={wager} disabled={active} onChange={(event) => setWager(Math.max(0, Math.trunc(Number(event.target.value))))} /></div><div className={styles.quickBets}><button disabled={active} onClick={() => setWager(settings.minBet)} type="button">MIN</button><button disabled={active} onClick={() => setWager(Math.min(settings.maxBet, Math.max(settings.minBet, Math.trunc(balance / 2))))} type="button">½</button><button disabled={active} onClick={() => setWager(Math.min(settings.maxBet, balance))} type="button">MAX</button></div></>} {game === "roulette" && <div className={styles.rouletteSidebarTotal}><span>TOTAL POSÉ</span><strong>{chips(rouletteTotal)}</strong><small>Choisis la valeur d’un jeton puis clique directement sur le tapis.</small></div>}<div className={styles.tableLimits}><span>Minimum <b>{chips(settings.minBet)}</b></span><span>Maximum <b>{chips(settings.maxBet)}</b></span><span>Plafond gain <b>{chips(settings.maxPayout)}</b></span></div></div></section>
          {game === "poker" && <section className={`${styles.panel} ${styles.pokerHelp}`}><p className={styles.eyebrow}>AIDE DES MAINS</p><h3>Combinaisons du poker</h3><div>{POKER_HANDS.map(([name,description],index) => <span key={name}><i>{index+1}</i><b>{name}</b><small>{description}</small></span>)}</div></section>}
          <section className={styles.panel}><p className={styles.eyebrow}>RÈGLES DE LA MAISON</p><p className={styles.responsibleCopy}>Les mises et résultats sont traités sur le serveur. Une partie interrompue est remboursée automatiquement après le délai de sécurité.</p></section>
        </aside>
      </div>
    </>
  );
}
