"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import base from "./casino.module.css";
import styles from "./casino-new-games.module.css";

type SpecialGame = "horse_racing" | "slots_tournament" | "card_battle";
type SpecialPlayer = { user_id: string; display_name: string; seat_no: number; wager: number; choice: string | null; score: number; turns_played: number; payout: number; state: Record<string, unknown>; is_me: boolean };
type SpecialRoom = {
  id: string; game: SpecialGame; name: string; host_name: string; max_players: number; visibility: "public" | "private"; join_code: string | null;
  status: "open" | "playing" | "finished" | "cancelled"; entry_fee: number; total_turns: number; result: Record<string, unknown>;
  is_host: boolean; is_seated: boolean; players: SpecialPlayer[];
};
type Snapshot = { rooms?: SpecialRoom[]; balance?: number; error?: string };

const META: Record<SpecialGame, { icon: string; label: string; copy: string; capacity: number }> = {
  horse_racing: { icon: "♞", label: "Courses hippiques", copy: "Chaque citoyen choisit son cheval et sa mise, puis tous regardent exactement la même course.", capacity: 6 },
  slots_tournament: { icon: "777", label: "Tournoi de machines", copy: "Une entrée fixe, dix tours chacun et une cagnotte remportée par le meilleur score.", capacity: 8 },
  card_battle: { icon: "A", label: "Bataille de cartes", copy: "Deux citoyens engagent la même somme. La plus haute carte remporte le pot.", capacity: 2 },
};
const HORSES = ["Éclair Noir", "Or Impérial", "Velours Rouge", "Nostra Star", "Vent d’Azur", "Saphir Royal"];

function chips(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }
function card(value: unknown): string {
  const cardValue = Math.max(0, Math.min(51, Math.trunc(Number(value))));
  const rank = cardValue % 13 + 2;
  const suit = ["♠", "♥", "♦", "♣"][Math.floor(cardValue / 13)] ?? "♠";
  return `${rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : rank}${suit}`;
}

function Race({ room }: { room: SpecialRoom }) {
  const order = Array.isArray(room.result?.order) ? room.result.order.map(Number) : [];
  const winner = Number(room.result?.winner ?? 0);
  return <div className={`${styles.raceTrack} ${room.status === "finished" ? styles.raceRunning : ""}`}>
    {HORSES.map((name, index) => {
      const place = Math.max(0, order.indexOf(index + 1));
      const style = { "--race-duration": `${5.2 + place * .22}s`, "--race-delay": `${(index % 3) * .08}s`, "--horse-finish": `${95 - place * 2.4}%` } as CSSProperties;
      return <div className={`${styles.raceLane} ${winner === index + 1 ? styles.raceWinner : ""}`} key={name}><small>{index + 1} · {name}</small><span className={styles.horse} style={style}>♞</span></div>;
    })}
  </div>;
}

function RoomStage({ room, pending, act }: { room: SpecialRoom; pending: boolean; act: (body: Record<string, unknown>, notice: string) => void }) {
  const me = room.players.find((player) => player.is_me);
  const [horse, setHorse] = useState(String(me?.choice ?? "1"));
  const [bet, setBet] = useState(Math.max(1, me?.wager || room.entry_fee));
  if (room.game === "horse_racing") return <div>
    <Race room={room} />
    {room.status === "open" && room.is_seated && <div className={styles.eventActions}><div className={styles.horsePicker}>{HORSES.map((name, index) => <button className={horse === String(index + 1) ? styles.horseActive : ""} onClick={() => setHorse(String(index + 1))} type="button" key={name}>{index + 1} · {name}</button>)}</div><input min="1" type="number" value={bet} onChange={(event) => setBet(Math.max(1, Math.trunc(Number(event.target.value))))} /><button className={base.primaryButton} disabled={pending || Boolean(me?.wager)} onClick={() => act({ action: "bet", roomId: room.id, amount: bet, choice: horse }, "Ton pari est verrouillé pour la course.")} type="button">{me?.wager ? `Pari enregistré · ${chips(me.wager)}` : `Parier ${chips(bet)} jetons`}</button></div>}
    {room.status === "finished" && <div className={styles.soloResult}><span>ARRIVÉE OFFICIELLE</span><strong>{HORSES[Math.max(0, Number(room.result?.winner ?? 1) - 1)]} remporte la course</strong><p>{String(room.result?.summary ?? "Résultat enregistré")}</p></div>}
  </div>;
  if (room.game === "slots_tournament") return <div>
    <div className={`${styles.slotScore} ${pending ? styles.slotScorePending : ""}`}>{(Array.isArray(me?.state?.last_symbols) ? me?.state.last_symbols : ["◆", "7", "✦"]).map((symbol, index) => <span key={index}>{String(symbol)}</span>)}</div>
    <div className={styles.leaderboard}>{[...room.players].sort((a, b) => b.score - a.score).map((player, index) => <span key={player.user_id}><b>{index + 1}. {player.display_name}</b><i>{chips(player.score)} pts · {player.turns_played}/{room.total_turns}</i></span>)}</div>
    {room.status === "playing" && me && me.turns_played < room.total_turns && <button className={base.primaryButton} disabled={pending} onClick={() => act({ action: "spin", roomId: room.id }, "Tour enregistré dans le classement.")} type="button">Lancer le tour {me.turns_played + 1}/{room.total_turns}</button>}
    {room.status === "playing" && me?.turns_played === room.total_turns && <div className={base.notice}>Tes dix tours sont terminés. Attente des autres citoyens…</div>}
    {room.status === "finished" && <div className={styles.soloResult}><strong>{String(room.result?.summary ?? "Tournoi terminé")}</strong><p>Ta récompense : {chips(me?.payout ?? 0)} jetons</p></div>}
  </div>;
  return <div className={styles.battleStage}>{room.players.map((player) => <div key={player.user_id}><strong>{player.display_name}</strong><span className={styles.battleCard}>{room.status === "finished" ? card(player.state?.card) : "CN"}</span><small>{room.status === "finished" ? `${chips(player.payout)} jetons` : "Carte scellée"}</small></div>)}<i>VS</i></div>;
}

export function CasinoSpecialMultiplayer({ initialBalance }: { initialBalance: number }) {
  const [rooms, setRooms] = useState<SpecialRoom[]>([]);
  const [balance, setBalance] = useState(initialBalance);
  const [game, setGame] = useState<SpecialGame>("horse_racing");
  const [name, setName] = useState("Salon Prestige");
  const [entryFee, setEntryFee] = useState(100);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const apply = useCallback((payload: Snapshot) => { if (Array.isArray(payload.rooms)) setRooms(payload.rooms); if (typeof payload.balance === "number") setBalance(payload.balance); }, []);
  const refresh = useCallback(async (quiet = false) => { const response = await fetch("/api/casino/special", { cache: "no-store" }); const payload = await response.json().catch(() => ({ error: "Réponse invalide." })) as Snapshot; if (response.ok) apply(payload); else if (!quiet) setError(payload.error ?? "Impossible de charger les salons."); }, [apply]);
  useEffect(() => { const timer = window.setTimeout(() => { const requested = window.location.hash.slice(1) as SpecialGame; if (requested in META) setGame(requested); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const first = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(true), 2500); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, [refresh]);
  function act(body: Record<string, unknown>, success: string) { setError(""); setNotice(""); startTransition(async () => { const response = await fetch("/api/casino/special", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({ error: "Réponse invalide." })) as Snapshot; if (!response.ok) { setError(payload.error ?? "Action refusée."); return; } apply(payload); setNotice(success); }); }

  const publicRooms = useMemo(() => rooms.filter((room) => room.visibility === "public" && room.status === "open" && !room.is_seated), [rooms]);
  const myRooms = useMemo(() => rooms.filter((room) => room.is_seated), [rooms]);
  const active = myRooms.some((room) => room.status === "open" || room.status === "playing");

  return <section className={styles.eventRoot}>
    <div className={styles.eventHero}><div><span className={styles.eventEyebrow}>NOUVEAUX JEUX MULTIJOUEURS</span><h2>Les grandes parties <em>du Cercle.</em></h2><p>Courses partagées, tournois à score et duels de cartes. Les mises sont verrouillées avant le départ et le résultat est identique pour tous les participants.</p></div><div className={styles.eventBalance}><span>TON SOLDE</span><strong>{chips(balance)} jetons</strong></div></div>
    {error && <div className={`${base.notice} ${base.error}`}>{error}</div>}{notice && <div className={`${base.notice} ${base.success}`}>{notice}</div>}
    <div className={styles.eventBuilder}><article className={styles.eventCreate}><span className={styles.eventEyebrow}>CRÉER UNE PARTIE</span><div className={styles.eventPicker}>{(Object.keys(META) as SpecialGame[]).map((key) => <button id={key} className={game === key ? styles.eventActive : ""} onClick={() => setGame(key)} type="button" key={key}><b>{META[key].icon}</b><strong>{META[key].label}</strong><small>{META[key].copy}</small></button>)}</div><div className={styles.eventForm}><label>Nom du salon<input maxLength={42} value={name} onChange={(event) => setName(event.target.value)} /></label><label>{game === "horse_racing" ? "Mise de départ" : "Entrée par joueur"}<input min="1" type="number" value={entryFee} onChange={(event) => setEntryFee(Math.max(1, Math.trunc(Number(event.target.value))))} /></label><label>Accès<select value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "private")}><option value="public">Public</option><option value="private">Privé</option></select></label><button className={base.primaryButton} disabled={pending || active || entryFee > balance} onClick={() => act({ action: "create", game, name, entryFee, visibility, capacity: META[game].capacity }, "Le salon est ouvert.")} type="button">{active ? "Termine d’abord ta partie" : `Ouvrir · ${game === "horse_racing" ? "pari à placer ensuite" : `${chips(entryFee)} jetons`}`}</button></div></article>
      <aside className={`${styles.eventPanel} ${styles.eventCode}`}><span className={styles.eventEyebrow}>INVITATION PRIVÉE</span><h3>Rejoindre par code</h3><p>Le code est visible uniquement par le créateur du salon.</p><input maxLength={8} value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="A1B2C3D4" /><button className={base.secondaryButton} disabled={pending || code.length !== 8 || active} onClick={() => act({ action: "join", code }, "Tu as rejoint la partie privée.")} type="button">Entrer dans le salon</button></aside>
    </div>
    <div><span className={styles.eventEyebrow}>SALONS PUBLICS</span><div className={styles.eventList}>{publicRooms.length === 0 && <div className={styles.emptyEvent}>Aucune nouvelle partie publique en attente.</div>}{publicRooms.map((room) => <article className={styles.eventRoom} key={room.id}><header><div><span className={styles.eventEyebrow}>{META[room.game].label}</span><h3>{room.name}</h3><small>{room.host_name} · {room.players.length}/{room.max_players} joueurs</small></div><b>{chips(room.entry_fee)} jetons</b></header><div className={styles.eventPlayers}>{room.players.map((player) => <span key={player.user_id}>{player.display_name}</span>)}</div><button className={base.primaryButton} disabled={pending || active || (room.game !== "horse_racing" && room.entry_fee > balance)} onClick={() => act({ action: "join", roomId: room.id }, "Tu as rejoint la partie.")} type="button">Rejoindre</button></article>)}</div></div>
    <div><span className={styles.eventEyebrow}>MES PARTIES</span><div className={styles.eventList}>{myRooms.length === 0 && <div className={styles.emptyEvent}>Tu ne participes encore à aucune de ces parties.</div>}{myRooms.map((room) => <article className={styles.eventRoom} key={room.id}><header><div><span className={styles.eventEyebrow}>{META[room.game].label} · {room.status.toUpperCase()}</span><h3>{room.name}</h3><small>{room.players.length}/{room.max_players} citoyens</small></div>{room.is_host && room.join_code && <b>CODE {room.join_code}</b>}</header><div className={styles.eventPlayers}>{room.players.map((player) => <span key={player.user_id}>{player.display_name}{player.wager ? ` · ${chips(player.wager)}` : ""}</span>)}</div><RoomStage room={room} pending={pending} act={act}/><div className={styles.eventActions}>{room.status === "open" && room.is_host && <><button className={base.dangerButton} disabled={pending} onClick={() => act({ action: "cancel", roomId: room.id }, "Partie annulée et mises remboursées.")} type="button">Annuler et rembourser</button><button className={base.primaryButton} disabled={pending || room.players.length < 2 || (room.game === "horse_racing" && room.players.some((player) => player.wager < 1))} onClick={() => act({ action: "start", roomId: room.id }, room.game === "slots_tournament" ? "Le tournoi commence." : "Le résultat est lancé pour tous les joueurs.")} type="button">{room.game === "slots_tournament" ? "Démarrer le tournoi" : "Lancer la partie"}</button></>}{room.status === "open" && !room.is_host && <button className={base.dangerButton} disabled={pending} onClick={() => act({ action: "leave", roomId: room.id }, "Tu as quitté la partie et récupéré ta mise.")} type="button">Quitter et récupérer la mise</button>}</div></article>)}</div></div>
  </section>;
}
