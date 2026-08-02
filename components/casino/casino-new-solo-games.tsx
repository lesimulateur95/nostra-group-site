"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CasinoGameKey, CasinoGameSettings } from "@/lib/casino/types";
import base from "./casino.module.css";
import styles from "./casino-new-games.module.css";

type MinesView = {
  active: boolean;
  wager: number;
  bombCount: number;
  revealed: number[];
  multiplier: number;
  potentialPayout: number;
  exploded?: number;
};

type SoloResponse = {
  error?: string;
  finished?: boolean;
  result?: string;
  balance?: number;
  payout?: number;
  wager?: number;
  mines?: MinesView;
  box?: number;
  boxType?: "loss" | "refund" | "multiplier" | "jackpot";
  multiplier?: number;
};

function chips(value: number): string {
  return Math.trunc(value).toLocaleString("fr-FR");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function CasinoNewSoloGame({ game, initialBalance, settings }: { game: Extract<CasinoGameKey, "mines" | "mystery_boxes">; initialBalance: number; settings: CasinoGameSettings }) {
  const [balance, setBalance] = useState(initialBalance);
  const [wager, setWager] = useState(settings.minBet);
  const [bombCount, setBombCount] = useState(3);
  const [result, setResult] = useState<SoloResponse | null>(null);
  const [mines, setMines] = useState<MinesView | null>(null);
  const [openingBox, setOpeningBox] = useState<number | null>(null);
  const [openedBox, setOpenedBox] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const minesActiveRef = useRef(false);
  const router = useRouter();

  useEffect(() => () => {
    if (game !== "mines" || !minesActiveRef.current) return;
    void fetch("/api/casino/abandon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "mines" }),
      keepalive: true,
    }).catch(() => undefined);
  }, [game]);

  useEffect(() => {
    if (game !== "mines" || !settings.enabled) return;
    let cancelled = false;
    void fetch("/api/casino/play", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game, action: "status", wager: settings.minBet }),
    }).then((response) => response.json()).then((payload: SoloResponse) => {
      if (cancelled || payload.error) return;
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (payload.mines?.active) {
        minesActiveRef.current = true;
        setMines(payload.mines);
        setWager(payload.mines.wager);
        setBombCount(payload.mines.bombCount);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [game, settings.enabled, settings.minBet]);

  const canStart = settings.enabled && wager >= settings.minBet && wager <= settings.maxBet && wager <= balance;

  function request(body: Record<string, unknown>) {
    setResult(null);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, wager, ...body }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as SoloResponse;
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (payload.mines) {
        minesActiveRef.current = payload.mines.active;
        setMines(payload.mines.active ? payload.mines : null);
      }
      setResult(payload);
      if (response.ok && payload.finished !== false) router.refresh();
    });
  }

  function abandonMines() {
    startTransition(async () => {
      const response = await fetch("/api/casino/abandon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game: "mines" }),
      });
      const payload = await response.json().catch(() => ({ error: "La sortie de la grille n’a pas pu être confirmée." })) as SoloResponse;
      if (!response.ok || payload.error) {
        setResult({ error: payload.error ?? "La sortie de la grille n’a pas pu être confirmée." });
        return;
      }
      minesActiveRef.current = false;
      setMines(null);
      setResult({ finished: true, result: "Grille quittée · mise perdue", payout: 0, wager, balance: payload.balance });
      if (typeof payload.balance === "number") setBalance(payload.balance);
      router.refresh();
    });
  }

  function openBox(index: number) {
    setResult(null);
    setOpenedBox(null);
    setOpeningBox(index);
    startTransition(async () => {
      const response = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, action: "play", wager, choice: String(index) }),
      });
      const payload = await response.json().catch(() => ({ error: "Réponse de table invalide." })) as SoloResponse;
      await wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 2_250);
      setOpeningBox(null);
      setOpenedBox(index);
      setResult(payload);
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (response.ok) router.refresh();
    });
  }

  return <>
    <section className={base.pageHeading}>
      <div><p className={base.eyebrow}>{game === "mines" ? "SALLE DU DÉMINEUR" : "CHAMBRE DES COFFRES"}</p><h1>{game === "mines" ? "Mines" : "Coffres mystères"}</h1></div>
      <div className={base.tableIntro}><p>{game === "mines" ? "Chaque case sûre augmente la somme à encaisser. Une bombe met immédiatement fin à la partie." : "Achète une partie, choisis ton coffre et regarde le mécanisme révéler le lot réellement attribué."}</p><span>{settings.enabled ? "● TABLE OUVERTE" : "● TABLE FERMÉE"}</span></div>
    </section>

    {!settings.enabled && <div className={base.notice}>Ce jeu est momentanément fermé par la Direction.</div>}
    {result?.error && <div className={`${base.notice} ${base.error}`}>{result.error}</div>}

    <div className={styles.soloLayout}>
      <section className={styles.soloStage}>
        {game === "mines" ? <>
          <header className={styles.minesHeader}><div><span>MULTIPLICATEUR ACTUEL</span><strong>×{(mines?.multiplier ?? 1).toFixed(2)}</strong></div><div><span>À ENCAISSER</span><strong>{chips(mines?.potentialPayout ?? wager)} jetons</strong></div><div><span>BOMBES</span><strong>{mines?.bombCount ?? bombCount}</strong></div></header>
          <div className={styles.mineGrid} aria-label="Grille Mines">
            {Array.from({ length: 25 }, (_, index) => {
              const revealed = mines?.revealed.includes(index) ?? false;
              const exploded = result?.mines?.exploded === index;
              return <button type="button" key={index} disabled={pending || !mines?.active || revealed || exploded} className={`${styles.mineCell} ${revealed ? styles.mineSafe : ""} ${exploded ? styles.mineExploded : ""}`} onClick={() => request({ action: "reveal", cell: index })}><span>{exploded ? "✹" : revealed ? "◆" : "?"}</span></button>;
            })}
          </div>
          {!mines?.active ? <button className={base.goldButton} disabled={pending || !canStart} onClick={() => request({ action: "start", choice: String(bombCount) })} type="button">{pending ? "Préparation de la grille…" : `Commencer · ${chips(wager)} jetons`}</button> : <><button className={styles.cashButton} disabled={pending || mines.revealed.length === 0} onClick={() => request({ action: "cashout" })} type="button">Encaisser {chips(mines.potentialPayout)} jetons</button><button className={base.dangerButton} disabled={pending} onClick={abandonMines} type="button">Quitter · mise perdue</button></>}
        </> : <>
          <div className={styles.vault}><span className={styles.vaultGlow} /><div className={styles.boxGrid}>
            {Array.from({ length: 6 }, (_, index) => <button aria-label={`Choisir le coffre ${index + 1}`} className={`${styles.mysteryBox} ${openingBox === index ? styles.boxOpening : ""} ${openedBox === index ? styles.boxOpened : ""}`} disabled={pending || !canStart} onClick={() => openBox(index)} type="button" key={index}><i /><b>CN</b><span>{index + 1}</span></button>)}
          </div><p>Les coffres sont identiques avant le choix. Le lot est calculé et crédité uniquement par le serveur.</p></div>
        </>}

        {result && !result.error && result.finished !== false && <div className={`${styles.soloResult} ${Number(result.payout ?? 0) >= Number(result.wager ?? wager) ? styles.resultWin : styles.resultLoss}`}><span>{result.boxType === "jackpot" ? "JACKPOT" : "RÉSULTAT"}</span><strong>{result.result}</strong><p>{chips(result.payout ?? 0)} jetons versés · solde {chips(balance)}</p></div>}
      </section>

      <aside className={styles.soloControls}>
        <span>TON PORTEFEUILLE</span><strong>{chips(balance)} jetons</strong>
        <label>Mise de la partie<input type="number" min={settings.minBet} max={Math.min(settings.maxBet, balance)} value={wager} disabled={Boolean(mines?.active) || pending} onChange={(event) => setWager(Math.max(0, Math.trunc(Number(event.target.value))))} /></label>
        <div className={styles.quickBets}><button disabled={Boolean(mines?.active)} onClick={() => setWager(settings.minBet)} type="button">MIN</button><button disabled={Boolean(mines?.active)} onClick={() => setWager(Math.min(settings.maxBet, Math.max(settings.minBet, Math.trunc(balance / 2))))} type="button">½</button><button disabled={Boolean(mines?.active)} onClick={() => setWager(Math.min(settings.maxBet, balance))} type="button">MAX</button></div>
        {game === "mines" && <label>Nombre de bombes<select value={bombCount} disabled={Boolean(mines?.active) || pending} onChange={(event) => setBombCount(Number(event.target.value))}>{[3,5,7,10].map((count) => <option value={count} key={count}>{count} bombes</option>)}</select></label>}
        <div className={styles.limits}><span>Minimum <b>{chips(settings.minBet)}</b></span><span>Maximum <b>{chips(settings.maxBet)}</b></span><span>Gain plafonné <b>{chips(settings.maxPayout)}</b></span></div>
      </aside>
    </div>
  </>;
}
