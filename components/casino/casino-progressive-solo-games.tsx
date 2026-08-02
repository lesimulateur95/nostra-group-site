"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CasinoGameKey, CasinoGameSettings } from "@/lib/casino/types";
import base from "./casino.module.css";
import styles from "./casino-new-games.module.css";

type ProgressiveGame = Extract<CasinoGameKey, "hi_lo" | "skyscraper" | "memory">;
type Card = { rank: number; suit: string };
type HiLoView = { active: boolean; wager: number; current: Card; streak: number; multiplier: number; potentialPayout: number };
type SkyscraperView = { active: boolean; wager: number; floor: number; maxFloors: number; multiplier: number; potentialPayout: number };
type MemoryView = { active: boolean; wager: number; cards: Array<string | null>; matched: number[]; selected: number | null; moves: number; moveLimit: number; pairs: number };
type ProgressiveResponse = {
  error?: string;
  active?: boolean;
  finished?: boolean;
  result?: string;
  balance?: number;
  payout?: number;
  wager?: number;
  multiplier?: number;
  previous?: Card;
  hiLo?: HiLoView;
  skyscraper?: SkyscraperView;
  memory?: MemoryView;
  chosenDoor?: number;
  doorSafe?: boolean;
  matched?: boolean;
  reveal?: Array<{ index: number; symbol: string }>;
};

const META: Record<ProgressiveGame, { eyebrow: string; title: string; copy: string }> = {
  hi_lo: { eyebrow: "SALON DES CARTES", title: "Hi-Lo", copy: "Devine si la prochaine carte sera plus haute ou plus basse. Chaque bonne réponse augmente la somme à encaisser." },
  skyscraper: { eyebrow: "TOUR DU CERCLE", title: "Gratte-ciel", copy: "Choisis une porte à chaque étage. Monte jusqu’au sommet ou encaisse avant qu’une porte condamnée ne fasse tout perdre." },
  memory: { eyebrow: "SALLE DES PAIRES", title: "Memory Casino", copy: "Retourne deux cartes à la fois et retrouve les six paires avant d’épuiser le nombre de coups autorisé." },
};

function chips(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }
function wait(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
function cardLabel(rank: number): string { return rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank); }

function PlayingCard({ card, moving = false }: { card?: Card; moving?: boolean }) {
  if (!card) return <span className={`${styles.hiloCard} ${styles.hiloCardBack}`}><b>CN</b><small>LE CERCLE</small></span>;
  const red = card.suit === "♥" || card.suit === "♦";
  return <span className={`${styles.hiloCard} ${red ? styles.hiloCardRed : ""} ${moving ? styles.hiloCardMoving : ""}`}><b>{cardLabel(card.rank)}</b><em>{card.suit}</em><small>{cardLabel(card.rank)}{card.suit}</small></span>;
}

export function CasinoProgressiveSoloGame({ game, initialBalance, settings }: { game: ProgressiveGame; initialBalance: number; settings: CasinoGameSettings }) {
  const [balance, setBalance] = useState(initialBalance);
  const [wager, setWager] = useState(settings.minBet);
  const [result, setResult] = useState<ProgressiveResponse | null>(null);
  const [hiLo, setHiLo] = useState<HiLoView | null>(null);
  const [skyscraper, setSkyscraper] = useState<SkyscraperView | null>(null);
  const [memory, setMemory] = useState<MemoryView | null>(null);
  const [movingCard, setMovingCard] = useState(false);
  const [movingDoor, setMovingDoor] = useState<number | null>(null);
  const [doorOutcome, setDoorOutcome] = useState<"safe" | "lost" | null>(null);
  const [temporaryCards, setTemporaryCards] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const activeRef = useRef(false);
  const router = useRouter();
  const meta = META[game];
  const active = Boolean(hiLo?.active || skyscraper?.active || memory?.active);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/casino/play", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game, action: "status", wager: settings.minBet }),
    }).then((response) => response.json()).then((payload: ProgressiveResponse) => {
      if (cancelled || payload.error) return;
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (payload.hiLo?.active) { setHiLo(payload.hiLo); setWager(payload.hiLo.wager); activeRef.current = true; }
      if (payload.skyscraper?.active) { setSkyscraper(payload.skyscraper); setWager(payload.skyscraper.wager); activeRef.current = true; }
      if (payload.memory?.active) { setMemory(payload.memory); setWager(payload.memory.wager); activeRef.current = true; }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [game, settings.minBet]);

  useEffect(() => () => {
    if (!activeRef.current) return;
    void fetch("/api/casino/abandon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game }),
      keepalive: true,
    }).catch(() => undefined);
  }, [game]);

  const canStart = settings.enabled && wager >= settings.minBet && wager <= settings.maxBet && wager <= balance;

  function applyPayload(payload: ProgressiveResponse) {
    if (typeof payload.balance === "number") setBalance(payload.balance);
    if (payload.hiLo) setHiLo(payload.hiLo.active ? payload.hiLo : null);
    if (payload.skyscraper) setSkyscraper(payload.skyscraper.active ? payload.skyscraper : null);
    if (payload.memory) setMemory(payload.memory.active ? payload.memory : payload.memory);
    const remainsActive = Boolean(payload.hiLo?.active || payload.skyscraper?.active || payload.memory?.active);
    activeRef.current = remainsActive;
    setResult(payload);
    if (payload.finished) router.refresh();
  }

  function request(action: string, extra: Record<string, unknown> = {}) {
    setResult(null);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, action, wager, ...extra }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as ProgressiveResponse;
      applyPayload(payload);
    });
  }

  function predict(action: "higher" | "lower") {
    setResult(null);
    setMovingCard(true);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game, action, wager }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as ProgressiveResponse;
      await wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 850);
      setMovingCard(false);
      applyPayload(payload);
    });
  }

  function chooseDoor(door: number) {
    setResult(null);
    setMovingDoor(door);
    setDoorOutcome(null);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game, action: "climb", wager, door }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as ProgressiveResponse;
      await wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 1_050);
      setDoorOutcome(payload.doorSafe === true ? "safe" : payload.doorSafe === false ? "lost" : null);
      await wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 520);
      setMovingDoor(null);
      applyPayload(payload);
    });
  }

  function flipMemory(card: number) {
    setResult(null);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game, action: "flip", wager, card }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as ProgressiveResponse;
      const reveal = Object.fromEntries((payload.reveal ?? []).map((item) => [item.index, item.symbol]));
      setTemporaryCards(reveal);
      if (payload.matched === false) await wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 160 : 1_050);
      applyPayload(payload);
      if (payload.matched === false) setTemporaryCards({});
    });
  }

  function abandon() {
    startTransition(async () => {
      const response = await fetch("/api/casino/abandon", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game }) });
      const payload = await response.json().catch(() => ({ error: "La sortie n’a pas pu être confirmée." })) as ProgressiveResponse;
      if (!response.ok || payload.error) { setResult({ error: payload.error ?? "La sortie n’a pas pu être confirmée." }); return; }
      activeRef.current = false;
      setHiLo(null); setSkyscraper(null); setMemory(null); setTemporaryCards({});
      if (typeof payload.balance === "number") setBalance(payload.balance);
      setResult({ finished: true, result: "Partie quittée · mise perdue", payout: 0, wager, balance: payload.balance });
      router.refresh();
    });
  }

  return <>
    <section className={base.pageHeading}>
      <div><p className={base.eyebrow}>{meta.eyebrow}</p><h1>{meta.title}</h1></div>
      <div className={base.tableIntro}><p>{meta.copy}</p><span>{settings.enabled ? "● TABLE OUVERTE" : "● TABLE FERMÉE"}</span></div>
    </section>
    {!settings.enabled && <div className={base.notice}>Ce jeu est momentanément fermé par la Direction.</div>}
    {result?.error && <div className={`${base.notice} ${base.error}`}>{result.error}</div>}

    <div className={styles.soloLayout}>
      <section className={styles.soloStage}>
        {game === "hi_lo" && <div className={styles.hiloStage}>
          <header className={styles.progressHeader}><div><span>SÉRIE</span><strong>{hiLo?.streak ?? 0} / 7</strong></div><div><span>MULTIPLICATEUR</span><strong>×{(hiLo?.multiplier ?? 1).toFixed(2)}</strong></div><div><span>À ENCAISSER</span><strong>{chips(hiLo?.potentialPayout ?? wager)}</strong></div></header>
          <div className={styles.hiloTable}><span className={styles.hiloShadow} /><PlayingCard card={hiLo?.current} moving={movingCard} /><p>{hiLo ? "La prochaine carte sera…" : "Place ta mise pour retourner la première carte."}</p></div>
          {!hiLo?.active ? <button className={base.goldButton} disabled={pending || !canStart} onClick={() => request("start")} type="button">Commencer · {chips(wager)} jetons</button> : <div className={styles.progressActions}>
            <button disabled={pending || hiLo.current.rank === 2} onClick={() => predict("lower")} type="button">↓ Plus basse</button>
            <button disabled={pending || hiLo.current.rank === 14} onClick={() => predict("higher")} type="button">↑ Plus haute</button>
            <button className={styles.cashButton} disabled={pending || hiLo.streak < 1} onClick={() => request("cashout")} type="button">Encaisser {chips(hiLo.potentialPayout)}</button>
            <button className={base.dangerButton} disabled={pending} onClick={abandon} type="button">Quitter · mise perdue</button>
          </div>}
        </div>}

        {game === "skyscraper" && <div className={styles.skyscraperStage}>
          <header className={styles.progressHeader}><div><span>ÉTAGE ATTEINT</span><strong>{skyscraper?.floor ?? 0} / 8</strong></div><div><span>MULTIPLICATEUR</span><strong>×{(skyscraper?.multiplier ?? 1).toFixed(2)}</strong></div><div><span>À ENCAISSER</span><strong>{chips(skyscraper?.potentialPayout ?? wager)}</strong></div></header>
          <div className={styles.tower}>
            {Array.from({ length: 8 }, (_, index) => 8 - index).map((floor) => {
              const passed = floor <= (skyscraper?.floor ?? 0);
              const current = floor === (skyscraper?.floor ?? 0) + 1 && Boolean(skyscraper?.active);
              return <div className={`${styles.towerFloor} ${passed ? styles.floorPassed : ""} ${current ? styles.floorCurrent : ""}`} key={floor}><b>{floor}</b><div>{[0, 1, 2].map((door) => <button aria-label={`Porte ${door + 1} de l’étage ${floor}`} className={`${movingDoor === door && current ? styles.doorMoving : ""} ${movingDoor === door && current && doorOutcome === "safe" ? styles.doorSafe : ""} ${movingDoor === door && current && doorOutcome === "lost" ? styles.doorLost : ""}`} disabled={!current || pending} onClick={() => chooseDoor(door)} type="button" key={door}><i /></button>)}</div></div>;
            })}
            <span className={styles.towerRoof}>LE CERCLE</span>
          </div>
          {!skyscraper?.active ? <button className={base.goldButton} disabled={pending || !canStart} onClick={() => request("start")} type="button">Entrer dans la tour · {chips(wager)} jetons</button> : <div className={styles.progressActions}><p>Choisis l’une des trois portes éclairées pour atteindre l’étage {skyscraper.floor + 1}.</p><button className={styles.cashButton} disabled={pending || skyscraper.floor < 1} onClick={() => request("cashout")} type="button">Sortir et encaisser {chips(skyscraper.potentialPayout)}</button><button className={base.dangerButton} disabled={pending} onClick={abandon} type="button">Quitter · mise perdue</button></div>}
        </div>}

        {game === "memory" && <div className={styles.memoryStage}>
          <header className={styles.progressHeader}><div><span>PAIRES</span><strong>{memory?.pairs ?? 0} / 6</strong></div><div><span>COUPS JOUÉS</span><strong>{memory?.moves ?? 0}</strong></div><div><span>COUPS RESTANTS</span><strong>{memory ? Math.max(0, memory.moveLimit - memory.moves) : "—"}</strong></div></header>
          <div className={styles.memoryGrid} aria-label="Grille Memory Casino">
            {Array.from({ length: 12 }, (_, index) => {
              const symbol = temporaryCards[index] ?? memory?.cards[index] ?? null;
              const found = memory?.matched.includes(index) ?? false;
              return <button aria-label={symbol ? `Carte ${symbol}` : `Retourner la carte ${index + 1}`} className={`${styles.memoryCard} ${symbol ? styles.memoryCardOpen : ""} ${found ? styles.memoryCardMatched : ""}`} disabled={pending || !memory?.active || found || memory?.selected === index} onClick={() => flipMemory(index)} type="button" key={index}><span><i>CN</i><b>{symbol ?? "?"}</b></span></button>;
            })}
          </div>
          {!memory?.active ? <button className={base.goldButton} disabled={pending || !canStart} onClick={() => { setMemory(null); setTemporaryCards({}); request("start"); }} type="button">Commencer · {chips(wager)} jetons</button> : <button className={base.dangerButton} disabled={pending} onClick={abandon} type="button">Quitter · mise perdue</button>}
        </div>}

        {result && !result.error && (result.finished || result.result) && <div className={`${styles.soloResult} ${Number(result.payout ?? 0) >= Number(result.wager ?? wager) && result.finished ? styles.resultWin : result.finished ? styles.resultLoss : styles.progressResult}`}><span>{result.finished ? "RÉSULTAT" : "PARTIE EN COURS"}</span><strong>{result.result}</strong>{result.finished && <p>{chips(result.payout ?? 0)} jetons versés · solde {chips(balance)}</p>}</div>}
      </section>

      <aside className={styles.soloControls}>
        <span>TON PORTEFEUILLE</span><strong>{chips(balance)} jetons</strong>
        <label>Mise de la partie<input type="number" min={settings.minBet} max={Math.min(settings.maxBet, balance)} value={wager} disabled={active || pending} onChange={(event) => setWager(Math.max(0, Math.trunc(Number(event.target.value))))} /></label>
        <div className={styles.quickBets}><button disabled={active || pending} onClick={() => setWager(settings.minBet)} type="button">MIN</button><button disabled={active || pending} onClick={() => setWager(Math.min(settings.maxBet, Math.max(settings.minBet, Math.trunc(balance / 2))))} type="button">½</button><button disabled={active || pending} onClick={() => setWager(Math.min(settings.maxBet, balance))} type="button">MAX</button></div>
        <div className={styles.limits}><span>Minimum <b>{chips(settings.minBet)}</b></span><span>Maximum <b>{chips(settings.maxBet)}</b></span><span>Gain plafonné <b>{chips(settings.maxPayout)}</b></span></div>
        <p className={styles.soloRule}>{game === "memory" ? "Le gain dépend du nombre de coups utilisés. Une partie parfaite déclenche le multiplicateur jackpot." : "Tu peux encaisser après la première réussite. Une erreur ou un abandon fait perdre la mise engagée."}</p>
      </aside>
    </div>
  </>;
}
