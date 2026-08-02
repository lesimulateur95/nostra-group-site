"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import styles from "./casino.module.css";

type PvpGame = "poker" | "dice" | "coinflip";
type PokerRoomState = {
  street: string;
  board: number[];
  pot: number;
  current_bet: number;
  min_raise: number;
  host_stack: number;
  guest_stack: number;
  host_bet: number;
  guest_bet: number;
  turn_side: "host" | "guest";
  my_side: "host" | "guest";
  is_turn: boolean;
  to_call: number;
  my_stack: number;
  my_cards: number[];
  last_action: string;
};
type PvpRoom = {
  id: string;
  game: PvpGame;
  host_name: string;
  guest_name: string | null;
  wager: number;
  visibility: "public" | "private";
  join_code: string | null;
  choice_host: string | null;
  status: "open" | "playing" | "finished" | "cancelled";
  result: Record<string, unknown>;
  poker_state: PokerRoomState | null;
  payout_host: number;
  payout_guest: number;
  is_host: boolean;
  is_guest: boolean;
  created_at: string;
  finished_at: string | null;
};

type LobbyResponse = { rooms?: PvpRoom[]; balance?: number; error?: string; actionResult?: Record<string, unknown> };

const GAME_META: Record<PvpGame, { icon: string; label: string; copy: string }> = {
  poker: { icon: "♠", label: "Poker citoyen", copy: "Un vrai heads-up Texas Hold’em : cave, blindes, enchères préflop, flop, turn et river." },
  dice: { icon: "⚄", label: "Duel de dés", copy: "Le créateur choisit moins ou plus de 7. L’adversaire défend automatiquement le côté opposé." },
  coinflip: { icon: "½", label: "Pile ou face", copy: "Le créateur choisit son côté, l’adversaire obtient l’autre. Le gagnant récupère le pot." },
};
const HAND_GUIDE = ["Quinte flush royale","Quinte flush","Carré","Full","Couleur","Suite","Brelan","Deux paires","Paire","Carte haute"];

function chips(value: number): string { return Math.trunc(value).toLocaleString("fr-FR"); }

function cardLabel(value: number): string {
  const rank = value % 13 + 2;
  const suit = ["♠", "♥", "♦", "♣"][Math.floor(value / 13)] ?? "♠";
  const label = rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank);
  return `${label}${suit}`;
}

function CardRow({ values, label }: { values: unknown; label: string }) {
  if (!Array.isArray(values)) return null;
  return <div className={styles.pvpCards}><small>{label}</small>{values.length ? <span>{values.map((card) => <i className={String(cardLabel(Number(card))).includes("♥") || String(cardLabel(Number(card))).includes("♦") ? styles.pvpRedCard : ""} key={String(card)}>{cardLabel(Number(card))}</i>)}</span> : <em>Cartes cachées par le joueur</em>}</div>;
}

function CitizenPokerTable({ room, balance, pending, act }: { room: PvpRoom; balance: number; pending: boolean; act: (body: Record<string, unknown>, success: string) => void }) {
  const [raise, setRaise] = useState(Math.max(1,Number(room.poker_state?.min_raise ?? 1)));
  const state = room.poker_state;
  if (!state) return <div className={styles.notice}>Synchronisation de la table…</div>;
  const canRaise = state.is_turn && raise >= state.min_raise && state.to_call + raise <= state.my_stack;
  return <div className={styles.pvpPokerLive}>
    <div className={styles.pvpPokerHeader}><span>{state.street.toUpperCase()}</span><strong>POT · {chips(state.pot)} JETONS</strong><small>{state.last_action || "La main est en cours"}</small></div>
    <div className={styles.pvpPokerPlayers}><span className={state.turn_side === "host" ? styles.pvpPokerTurn : ""}><b>{room.host_name}</b><small>{chips(state.host_stack)} derrière · {chips(state.host_bet)} misé</small></span><i>VS</i><span className={state.turn_side === "guest" ? styles.pvpPokerTurn : ""}><b>{room.guest_name}</b><small>{chips(state.guest_stack)} derrière · {chips(state.guest_bet)} misé</small></span></div>
    <div className={styles.pvpPokerBoard}><CardRow label="TES CARTES" values={state.my_cards} /><CardRow label="CARTES COMMUNES" values={state.board} /></div>
    {!state.is_turn ? <div className={styles.pvpPokerWaiting}>Au tour de ton adversaire… La table se met à jour automatiquement.</div> : <div className={styles.pvpPokerControls}>
      <div><span>À suivre <b>{chips(state.to_call)}</b></span><span>Ton tapis <b>{chips(state.my_stack)}</b></span><span>Relance mini <b>{chips(state.min_raise)}</b></span></div>
      <label>Relancer de <input type="number" min={state.min_raise} max={Math.max(state.min_raise,state.my_stack-state.to_call)} value={raise} onChange={(event) => setRaise(Math.max(0,Math.trunc(Number(event.target.value))))} /></label>
      <section><button className={styles.dangerButton} disabled={pending} onClick={() => act({action:"poker_action",roomId:room.id,pokerAction:"fold"},"Tu t’es couché. La main est terminée.")} type="button">Se coucher</button><button className={styles.secondaryButton} disabled={pending || state.to_call>0} onClick={() => act({action:"poker_action",roomId:room.id,pokerAction:"check"},"Parole enregistrée.")} type="button">Parole</button><button className={styles.secondaryButton} disabled={pending || state.to_call===0} onClick={() => act({action:"poker_action",roomId:room.id,pokerAction:"call"},"La mise est suivie.")} type="button">Suivre {chips(state.to_call)}</button><button className={styles.primaryButton} disabled={pending || !canRaise} onClick={() => act({action:"poker_action",roomId:room.id,pokerAction:"raise",amount:raise},`Relance de ${chips(raise)} enregistrée.`)} type="button">Relancer</button><button className={styles.allInButton} disabled={pending || state.my_stack + balance < 1} onClick={() => act({action:"poker_action",roomId:room.id,pokerAction:"allin"},"Tout ton solde de jetons est engagé.")} type="button">Tapis · {chips(state.my_stack + balance)}</button></section>
    </div>}
    <aside className={styles.pvpPokerHelp}><span>AIDE DES COMBINAISONS</span>{HAND_GUIDE.map((hand,index) => <small key={hand}><i>{index+1}</i>{hand}</small>)}</aside>
  </div>;
}

export function CasinoMultiplayer({ initialBalance }: { initialBalance: number }) {
  const [rooms, setRooms] = useState<PvpRoom[]>([]);
  const [balance, setBalance] = useState(initialBalance);
  const [game, setGame] = useState<PvpGame>("poker");
  const [wager, setWager] = useState(100);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [choice, setChoice] = useState("heads");
  const [privateCode, setPrivateCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const applySnapshot = useCallback((payload: LobbyResponse) => {
    if (Array.isArray(payload.rooms)) setRooms(payload.rooms);
    if (typeof payload.balance === "number") setBalance(payload.balance);
  }, []);

  const refreshLobby = useCallback(async (quiet = false) => {
    const response = await fetch("/api/casino/multiplayer", { cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "Réponse invalide." })) as LobbyResponse;
    if (response.ok) applySnapshot(payload);
    else if (!quiet) setError(payload.error ?? "Impossible de charger le salon.");
  }, [applySnapshot]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshLobby(), 0);
    const timer = window.setInterval(() => void refreshLobby(true), 3000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refreshLobby]);

  function act(body: Record<string, unknown>, success: string) {
    setError(""); setNotice("");
    startTransition(async () => {
      const response = await fetch("/api/casino/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({ error: "Réponse invalide." })) as LobbyResponse;
      if (!response.ok) { setError(payload.error ?? "Action refusée."); return; }
      applySnapshot(payload);
      setNotice(success);
      if (body.action === "join") setPrivateCode("");
    });
  }

  const openRooms = useMemo(() => rooms.filter((room) => room.status === "open" && !room.is_host), [rooms]);
  const myRooms = useMemo(() => rooms.filter((room) => room.is_host || room.is_guest), [rooms]);
  const ownOpenRoom = myRooms.find((room) => (room.is_host || room.is_guest) && (room.status === "open" || room.status === "playing"));

  return (
    <>
      <section className={styles.pvpHero}>
        <div><p className={styles.eyebrow}>SALON MULTIJOUEUR</p><h1>Citoyen contre <em>citoyen.</em></h1><p>Crée une table publique, partage un code privé ou accepte un défi déjà ouvert. Les deux mises sont verrouillées et le résultat est traité en une seule transaction côté serveur.</p></div>
        <div className={styles.pvpBalance}><span>TON SOLDE</span><strong>{chips(balance)}</strong><small>JETONS DISPONIBLES</small><i>MISE À JOUR EN DIRECT</i></div>
      </section>

      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
      {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

      <section className={styles.pvpLayout}>
        <article className={styles.pvpCreatePanel}>
          <div className={styles.panelHeader}><div><p className={styles.eyebrow}>NOUVEAU DÉFI</p><h2>Ouvrir une table</h2></div><span className={styles.statusBadge}>MISE BLOQUÉE</span></div>
          <div className={styles.pvpGamePicker}>
            {(Object.keys(GAME_META) as PvpGame[]).map((key) => <button className={game === key ? styles.pvpGameActive : ""} type="button" onClick={() => { setGame(key); setChoice(key === "dice" ? "under" : "heads"); }} key={key}><b>{GAME_META[key].icon}</b><span>{GAME_META[key].label}</span></button>)}
          </div>
          <p className={styles.pvpGameCopy}>{GAME_META[game].copy}</p>
          <div className={styles.formStack}>
            <div className={styles.formRow}>
              <div className={styles.field}><label htmlFor="pvp-wager">{game === "poker" ? "Cave par citoyen" : "Mise par citoyen"}</label><input id="pvp-wager" type="number" min="1" value={wager} onChange={(event) => setWager(Math.max(1,Math.trunc(Number(event.target.value))))} /></div>
              <div className={styles.field}><label htmlFor="pvp-visibility">Type de salon</label><select id="pvp-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "private")}><option value="public">Public — visible par tous</option><option value="private">Privé — code d’accès</option></select></div>
            </div>
            {game !== "poker" && <div className={styles.field}><label>Ton choix</label><div className={styles.pvpChoiceRow}>{(game === "coinflip" ? [["heads","Pile"],["tails","Face"]] : [["under","Moins de 7"],["over","Plus de 7"]]).map(([value,label]) => <button className={choice === value ? styles.pvpChoiceActive : ""} type="button" onClick={() => setChoice(value)} key={value}>{label}</button>)}</div></div>}
            <button className={styles.primaryButton} disabled={pending || Boolean(ownOpenRoom) || wager > balance} type="button" onClick={() => act({ action:"create",game,wager,visibility,choice },"Le défi est ouvert. Ta mise est sécurisée jusqu’à l’arrivée d’un citoyen.")}>{pending ? "Ouverture…" : ownOpenRoom ? "Un défi est déjà ouvert" : `Ouvrir le défi · ${chips(wager)} jetons`}</button>
          </div>
        </article>

        <aside className={styles.pvpPrivatePanel}>
          <p className={styles.eyebrow}>CODE PRIVÉ</p><h2>Rejoindre une invitation</h2><p>Entre le code communiqué par le créateur. La table privée n’apparaît jamais dans la liste publique.</p>
          <div className={styles.field}><label htmlFor="pvp-code">Code du salon</label><input id="pvp-code" value={privateCode} maxLength={8} onChange={(event) => setPrivateCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} placeholder="EX. A1B2C3D4" /></div>
          <button className={styles.secondaryButton} disabled={pending || privateCode.length !== 8} type="button" onClick={() => act({ action:"join",code:privateCode },"Table rejointe. Si c’est un poker, la première main commence maintenant.")}>Rejoindre avec le code</button>
          <div className={styles.pvpSafety}><b>VERROUILLAGE SERVEUR</b><span>Impossible de rejoindre deux fois, de modifier le résultat ou de récupérer une mise déjà engagée.</span></div>
        </aside>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>TABLES PUBLIQUES</p><h2>Défis en attente</h2><p>La liste se rafraîchit automatiquement toutes les trois secondes.</p></div><button className={styles.pvpRefresh} disabled={pending} onClick={() => void refreshLobby()} type="button">Actualiser maintenant</button></div>
        <div className={styles.pvpRoomGrid}>
          {openRooms.length === 0 && <div className={styles.pvpEmpty}><span>♠</span><h3>Aucun défi public en attente</h3><p>Sois le premier à ouvrir une table ou utilise un code privé.</p></div>}
          {openRooms.map((room) => <article className={styles.pvpRoomCard} key={room.id}><header><span>{GAME_META[room.game].icon}</span><div><small>{room.visibility === "public" ? "TABLE PUBLIQUE" : "TABLE PRIVÉE"}</small><h3>{GAME_META[room.game].label}</h3></div></header><div className={styles.pvpVersus}><strong>{room.host_name}</strong><i>VS</i><strong>PLACE LIBRE</strong></div><div className={styles.pvpRoomStake}><span>{room.game === "poker" ? "Cave par joueur" : "Mise par joueur"}</span><b>{chips(room.wager)} jetons</b><small>{room.game === "poker" ? "Blindes prélevées dans la cave" : `Pot total ${chips(room.wager * 2)}`}</small></div><button className={styles.primaryButton} disabled={pending || room.wager > balance} type="button" onClick={() => act({ action:"join",roomId:room.id },"Table rejointe. Si c’est un poker, la première main commence maintenant.")}>{room.wager > balance ? "Solde insuffisant" : "Accepter le défi"}</button></article>)}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>MES SALONS</p><h2>Défis et résultats</h2><p>Les codes privés et les derniers résultats sont conservés ici.</p></div><Link className={styles.textLink} href="/casino/jeux/poker">Poker solo contre les bots →</Link></div>
        <div className={styles.pvpHistory}>
          {myRooms.length === 0 && <div className={styles.notice}>Tu n’as pas encore participé à un défi citoyen.</div>}
          {myRooms.map((room) => <article className={`${styles.pvpHistoryCard} ${room.status === "finished" ? styles.pvpFinished : ""}`} key={room.id}><header><span>{GAME_META[room.game].icon}</span><div><small>{room.status === "open" ? "EN ATTENTE D’UN ADVERSAIRE" : room.status === "playing" ? "MAIN EN COURS" : room.status === "cancelled" ? "ANNULÉ" : "TERMINÉ"}</small><h3>{GAME_META[room.game].label}</h3></div><b>{chips(room.wager)} jetons / joueur</b></header>{room.status === "open" ? <div className={styles.pvpWaiting}><p>Ta mise est bloquée. {room.visibility === "private" ? <>Communique ce code : <strong>{room.join_code}</strong></> : "La table est visible dans le salon public."}</p>{room.is_host && <button className={styles.dangerButton} disabled={pending} type="button" onClick={() => act({ action:"cancel",roomId:room.id },"Le défi a été annulé et ta mise remboursée.")}>Annuler et rembourser</button>}</div> : room.status === "playing" && room.game === "poker" ? <CitizenPokerTable room={room} balance={balance} pending={pending} act={act} /> : <div className={styles.pvpResult}><strong>{String(room.result?.summary ?? (room.status === "cancelled" ? "Défi annulé" : "Résultat enregistré"))}</strong><p>{room.host_name} : {chips(room.payout_host)} jetons · {room.guest_name ?? "—"} : {chips(room.payout_guest)} jetons</p>{room.game === "poker" && room.status === "finished" && <><div className={styles.pvpShowdown}><CardRow label={room.host_name} values={room.result?.host_cards} /><CardRow label="CARTES COMMUNES" values={room.result?.board} /><CardRow label={room.guest_name ?? "ADVERSAIRE"} values={room.result?.guest_cards} /></div><div className={styles.pvpRevealChoice}><span>À toi de décider si les autres citoyens peuvent voir tes cartes.</span><button className={styles.secondaryButton} disabled={pending} onClick={() => act({action:"show_cards",roomId:room.id,show:false},"Tes cartes restent cachées.")} type="button">Cacher mes cartes</button><button className={styles.primaryButton} disabled={pending} onClick={() => act({action:"show_cards",roomId:room.id,show:true},"Tes cartes sont maintenant visibles.")} type="button">Montrer mes cartes</button></div></>}{room.game === "coinflip" && room.status === "finished" && <span className={styles.pvpOutcome}>{room.result?.outcome === "heads" ? "PILE" : "FACE"}</span>}{room.game === "dice" && room.status === "finished" && <span className={styles.pvpOutcome}>{String(room.result?.number ?? "—")}</span>}</div>}</article>)}
        </div>
      </section>
    </>
  );
}
