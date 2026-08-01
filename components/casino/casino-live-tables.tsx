"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import styles from "./casino.module.css";

type LiveGame = "roulette" | "blackjack" | "baccarat";
type LiveStatus = "open" | "betting" | "playing" | "finished" | "cancelled";
type LivePlayer = {
  user_id: string;
  display_name: string;
  seat_no: number;
  bet_amount: number;
  bet_choice: string | null;
  hand: number[];
  hand_value: number;
  status: string;
  payout: number;
  is_me: boolean;
};
type LiveTable = {
  id: string;
  game: LiveGame;
  name: string;
  host_name: string;
  max_players: number;
  visibility: "public" | "private";
  join_code: string | null;
  status: LiveStatus;
  phase: string;
  round_no: number;
  dealer_hand: number[];
  dealer_value: number;
  result: Record<string, unknown>;
  players: LivePlayer[];
  is_host: boolean;
  is_seated: boolean;
  created_at: string;
};
type LiveResponse = { tables?: LiveTable[]; balance?: number; error?: string };

const META: Record<LiveGame, { icon: string; label: string; copy: string; capacity: number }> = {
  roulette: { icon: "◉", label: "Roulette européenne live", copy: "Un même numéro pour toute la table. Chaque citoyen peut poser plusieurs jetons sur le tapis avant le lancer.", capacity: 6 },
  blackjack: { icon: "21", label: "Blackjack multijoueur", copy: "Deux à six joueurs face au même croupier. Chacun tire ou reste à son tour, selon les règles réelles du 21.", capacity: 6 },
  baccarat: { icon: "B", label: "Baccarat live", copy: "Mise sur Joueur, Banque ou Égalité. Le tirage de la troisième carte suit les règles classiques du baccarat.", capacity: 6 },
};
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROULETTE_TARGETS = ["red", "black", "even", "odd", "low", "high"] as const;

function chips(value: number): string { return Math.trunc(value || 0).toLocaleString("fr-FR"); }
function cardLabel(card: number): string {
  const rank = card % 13 + 2;
  const suit = ["♠", "♥", "♦", "♣"][Math.floor(card / 13)] ?? "♠";
  const label = rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank);
  return `${label}${suit}`;
}
function Card({ value, hidden = false, delay = 0 }: { value?: number; hidden?: boolean; delay?: number }) {
  const label = value === undefined ? "" : cardLabel(value);
  const red = label.includes("♥") || label.includes("♦");
  return <i className={`${styles.liveCard} ${hidden ? styles.liveCardBack : ""} ${red ? styles.liveCardRed : ""}`} style={{ animationDelay: `${delay}ms` }}>{hidden ? "N" : label}</i>;
}

function LiveStage({ table, pending, act }: { table: LiveTable; pending: boolean; act: (body: Record<string, unknown>, success: string) => void }) {
  const me = table.players.find((player) => player.is_me);
  const resultNumber = Number(table.result?.number);
  const spinning = table.status === "finished";
  if (table.game === "roulette") {
    return <div className={styles.liveRouletteStage}>
      <div className={`${styles.liveRouletteWheel} ${spinning ? styles.liveRouletteSpinning : ""}`}><span className={styles.liveRouletteBall} /><b>{Number.isFinite(resultNumber) ? resultNumber : "N"}</b></div>
      <div className={styles.liveTableMessage}><span>{table.status === "finished" ? "NUMÉRO SORTI" : "LA TABLE ATTEND LE LANCER"}</span><strong>{Number.isFinite(resultNumber) ? `${resultNumber} · ${resultNumber === 0 ? "VERT" : RED.has(resultNumber) ? "ROUGE" : "NOIR"}` : "Mises ouvertes"}</strong></div>
    </div>;
  }
  if (table.game === "baccarat") {
    const playerCards = Array.isArray(table.result?.player_cards) ? table.result.player_cards.map(Number) : [];
    const bankerCards = Array.isArray(table.result?.banker_cards) ? table.result.banker_cards.map(Number) : [];
    return <div className={styles.liveBaccaratStage}>
      <div><span>JOUEUR · {String(table.result?.player_value ?? "—")}</span><section>{playerCards.length ? playerCards.map((card,index) => <Card value={card} delay={index*130} key={`p-${card}`} />) : <><Card hidden /><Card hidden /></>}</section></div>
      <em>VS</em>
      <div><span>BANQUE · {String(table.result?.banker_value ?? "—")}</span><section>{bankerCards.length ? bankerCards.map((card,index) => <Card value={card} delay={180+index*130} key={`b-${card}`} />) : <><Card hidden /><Card hidden /></>}</section></div>
      <strong>{String(table.result?.summary ?? "Le sabot est prêt")}</strong>
    </div>;
  }
  return <div className={styles.liveBlackjackStage}>
    <div className={styles.liveDealer}><span>CROUPIER · {table.status === "finished" ? table.dealer_value : table.dealer_hand.length ? "?" : "—"}</span><section>{table.dealer_hand.length ? <>{table.dealer_hand.map((card,index) => <Card value={card} delay={index*130} key={`d-${index}`} />)}{table.status !== "finished" && <Card hidden delay={130} />}</> : <><Card hidden /><Card hidden /></>}</section></div>
    <div className={styles.liveBlackjackSeats}>{table.players.map((player) => <article className={`${player.is_me ? styles.liveSeatMe : ""} ${player.status === "bust" ? styles.liveSeatBust : ""}`} key={player.user_id}><small>SIÈGE {player.seat_no}</small><b>{player.display_name}</b><span>{chips(player.bet_amount)} jetons · {player.hand_value || "—"}</span><div>{player.hand.length ? player.hand.map((card,index) => <Card value={card} delay={index*110} key={`${player.user_id}-${index}`} />) : <Card hidden />}</div><em>{player.status === "playing" ? "À TOI DE JOUER" : player.status.toUpperCase()}</em></article>)}</div>
    {table.status === "playing" && me?.status === "playing" && <div className={styles.livePlayerActions}><button className={styles.secondaryButton} disabled={pending} onClick={() => act({ action:"blackjack_action",tableId:table.id,play:"hit" },"Le croupier distribue une carte.")} type="button">Tirer une carte</button><button className={styles.primaryButton} disabled={pending} onClick={() => act({ action:"blackjack_action",tableId:table.id,play:"stand" },"Tu restes sur cette main.")} type="button">Rester</button></div>}
  </div>;
}

function BettingDesk({ table, balance, pending, act }: { table: LiveTable; balance: number; pending: boolean; act: (body: Record<string, unknown>, success: string) => void }) {
  const me = table.players.find((player) => player.is_me);
  const [amount, setAmount] = useState(100);
  const [choice, setChoice] = useState(table.game === "baccarat" ? "player" : "");
  const [chip, setChip] = useState(50);
  const [rouletteNumber, setRouletteNumber] = useState(0);
  const [bets, setBets] = useState<Record<string,number>>({});
  const total = Object.values(bets).reduce((sum,value) => sum + value,0);
  const place = (target: string) => setBets((current) => ({ ...current, [target]:(current[target] ?? 0)+chip }));
  if (!me || table.status !== "open") return null;
  if (me.bet_amount > 0) return <div className={styles.liveBetLocked}><b>MISE VERROUILLÉE</b><span>{chips(me.bet_amount)} jetons sont posés. Le créateur peut maintenant lancer la table.</span></div>;
  if (table.game === "roulette") return <div className={styles.liveBetDesk}>
    <header><span>TON TAPIS</span><b>{chips(total)} jetons posés</b></header>
    <div className={styles.liveChipRack}>{[10,50,100,500,1000].map((value) => <button className={chip === value ? styles.liveChipActive : ""} onClick={() => setChip(value)} type="button" key={value}>{chips(value)}</button>)}</div>
    <div className={styles.liveRouletteOutside}>{ROULETTE_TARGETS.map((target) => <button onClick={() => place(target)} type="button" key={target}>{target === "red" ? "ROUGE" : target === "black" ? "NOIR" : target === "even" ? "PAIR" : target === "odd" ? "IMPAIR" : target === "low" ? "1–18" : "19–36"}<small>{bets[target] ? chips(bets[target]) : ""}</small></button>)}</div>
    <div className={styles.liveNumberBet}><input min="0" max="36" type="number" value={rouletteNumber} onChange={(event) => setRouletteNumber(Math.max(0,Math.min(36,Math.trunc(Number(event.target.value)))))} /><button className={styles.secondaryButton} onClick={() => place(`number:${rouletteNumber}`)} type="button">Poser sur le numéro</button></div>
    <div className={styles.liveBetActions}><button className={styles.dangerButton} onClick={() => setBets({})} type="button">Retirer les jetons</button><button className={styles.primaryButton} disabled={pending || total < 1 || total > balance} onClick={() => act({ action:"bet",tableId:table.id,bets:Object.entries(bets).map(([target,value]) => ({target,value})) },"Tes jetons sont verrouillés sur le tapis live.")} type="button">Valider {chips(total)} jetons</button></div>
  </div>;
  return <div className={styles.liveBetDesk}>
    <header><span>{table.game === "baccarat" ? "PARI DE LA MAIN" : "MISE DU BLACKJACK"}</span><b>{chips(amount)} jetons</b></header>
    {table.game === "baccarat" && <div className={styles.liveBaccaratChoices}>{[["player","Joueur · ×2"],["banker","Banque · ×1,95"],["tie","Égalité · ×9"]].map(([value,label]) => <button className={choice === value ? styles.liveChoiceActive : ""} onClick={() => setChoice(value)} type="button" key={value}>{label}</button>)}</div>}
    <input className={styles.liveWagerInput} min="1" max={balance} type="number" value={amount} onChange={(event) => setAmount(Math.max(1,Math.trunc(Number(event.target.value))))} />
    <button className={styles.primaryButton} disabled={pending || amount > balance} onClick={() => act({ action:"bet",tableId:table.id,amount,choice },"Ta mise est verrouillée pour la prochaine main.")} type="button">Poser {chips(amount)} jetons</button>
  </div>;
}

export function CasinoLiveTables({ initialBalance }: { initialBalance: number }) {
  const [tables,setTables] = useState<LiveTable[]>([]);
  const [balance,setBalance] = useState(initialBalance);
  const [game,setGame] = useState<LiveGame>("roulette");
  const [capacity,setCapacity] = useState(6);
  const [visibility,setVisibility] = useState<"public"|"private">("public");
  const [tableName,setTableName] = useState("Table prestige");
  const [privateCode,setPrivateCode] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [pending,startTransition] = useTransition();
  const apply = useCallback((payload: LiveResponse) => { if (Array.isArray(payload.tables)) setTables(payload.tables); if (typeof payload.balance === "number") setBalance(payload.balance); },[]);
  const refresh = useCallback(async (quiet=false) => { const response=await fetch("/api/casino/live",{cache:"no-store"}); const payload=await response.json().catch(()=>({error:"Réponse invalide."})) as LiveResponse; if(response.ok)apply(payload);else if(!quiet)setError(payload.error??"Impossible de charger les tables live."); },[apply]);
  useEffect(() => { const first=window.setTimeout(()=>void refresh(),0); const timer=window.setInterval(()=>void refresh(true),2000); return()=>{window.clearTimeout(first);window.clearInterval(timer);}; },[refresh]);
  function act(body:Record<string,unknown>,success:string){setError("");setNotice("");startTransition(async()=>{const response=await fetch("/api/casino/live",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({error:"Réponse invalide."})) as LiveResponse;if(!response.ok){setError(payload.error??"Action refusée.");return;}apply(payload);setNotice(success);});}
  const publicTables=useMemo(()=>tables.filter((table)=>table.visibility==="public"&&table.status==="open"&&!table.is_seated),[tables]);
  const myTables=useMemo(()=>tables.filter((table)=>table.is_seated),[tables]);
  const active=myTables.some((table)=>["open","playing"].includes(table.status));
  return <section className={styles.liveFloor}>
    <div className={styles.liveFloorHeading}><div><p className={styles.eyebrow}>NOUVEL ÉTAGE · TABLES LIVE</p><h2>Le casino joue <em>en temps réel.</em></h2><p>De vraies tables partagées avec sièges, mises individuelles, croupier automatique et animations synchronisées pour tous les citoyens.</p></div><div className={styles.liveConnection}><i /><span>TABLES CONNECTÉES</span><b>{chips(balance)} jetons</b></div></div>
    {error&&<div className={`${styles.notice} ${styles.error}`}>{error}</div>}{notice&&<div className={`${styles.notice} ${styles.success}`}>{notice}</div>}
    <div className={styles.liveCreateLayout}><article className={styles.liveCreatePanel}><div className={styles.liveGamePicker}>{(Object.keys(META) as LiveGame[]).map((key)=><button className={game===key?styles.liveGameActive:""} onClick={()=>{setGame(key);setCapacity(META[key].capacity);}} type="button" key={key}><b>{META[key].icon}</b><span>{META[key].label}</span><small>{META[key].copy}</small></button>)}</div><div className={styles.liveCreateForm}><label>Nom de la table<input maxLength={42} value={tableName} onChange={(event)=>setTableName(event.target.value)} /></label><label>Places<select value={capacity} onChange={(event)=>setCapacity(Number(event.target.value))}>{[2,3,4,5,6].map((value)=><option value={value} key={value}>{value} joueurs</option>)}</select></label><label>Accès<select value={visibility} onChange={(event)=>setVisibility(event.target.value as "public"|"private")}><option value="public">Table publique</option><option value="private">Table privée</option></select></label><button className={styles.primaryButton} disabled={pending||active} onClick={()=>act({action:"create",game,capacity,visibility,name:tableName},"La table live est ouverte. Prends place et attends les citoyens.")} type="button">{active?"Termine d’abord ta table":"Ouvrir la table live"}</button></div></article><aside className={styles.liveCodePanel}><span>INVITATION PRIVÉE</span><h3>Rejoindre par code</h3><p>Les tables privées restent invisibles dans le hall.</p><input maxLength={8} value={privateCode} onChange={(event)=>setPrivateCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} placeholder="A1B2C3D4" /><button className={styles.secondaryButton} disabled={pending||privateCode.length!==8} onClick={()=>act({action:"join",code:privateCode},"Tu as pris place à la table privée.")} type="button">Entrer à la table</button></aside></div>
    <div className={styles.livePublicSection}><header><div><span>TABLES PUBLIQUES</span><h3>Places disponibles</h3></div><button onClick={()=>void refresh()} type="button">Actualiser</button></header><div className={styles.liveTableGrid}>{publicTables.length===0&&<div className={styles.pvpEmpty}><span>◉</span><h3>Aucune table live ouverte</h3><p>Ouvre la première table ou utilise un code privé.</p></div>}{publicTables.map((table)=><article className={styles.liveLobbyCard} key={table.id}><div className={styles.liveLobbyArt}><b>{META[table.game].icon}</b><i /><i /><i /></div><span>{META[table.game].label}</span><h4>{table.name}</h4><p>Croupier automatique · {table.players.length}/{table.max_players} sièges occupés</p><div>{table.players.map((player)=><small key={player.user_id}>{player.display_name}</small>)}</div><button className={styles.primaryButton} disabled={pending||active||table.players.length>=table.max_players} onClick={()=>act({action:"join",tableId:table.id},"Tu as pris place à la table live.")} type="button">Prendre un siège</button></article>)}</div></div>
    <div className={styles.liveMyTables}>
      <header><span>MES TABLES LIVE</span><h3>Parties et résultats</h3></header>
      {myTables.length===0&&<div className={styles.notice}>Tu n’es assis à aucune table live.</div>}
      {myTables.map((table)=><article className={styles.liveTableRoom} key={table.id}>
        <header><div><small>{META[table.game].label} · MAIN {table.round_no}</small><h3>{table.name}</h3><span>{table.players.length}/{table.max_players} joueurs · {table.status.toUpperCase()}</span></div>{table.is_host&&table.join_code&&<b>CODE {table.join_code}</b>}</header>
        <LiveStage table={table} pending={pending} act={act}/><BettingDesk table={table} balance={balance} pending={pending} act={act}/>
        <div className={styles.liveRoomActions}>
          {table.status==="open"&&!table.is_host&&<button className={styles.dangerButton} disabled={pending} onClick={()=>act({action:"leave",tableId:table.id},"Tu as quitté la table et ta mise a été remboursée.")} type="button">Quitter la table</button>}
          {table.status==="open"&&table.is_host&&<><button className={styles.dangerButton} disabled={pending} onClick={()=>act({action:"cancel",tableId:table.id},"Table annulée et toutes les mises remboursées.")} type="button">Fermer et rembourser</button><button className={styles.primaryButton} disabled={pending||table.players.length<2||table.players.some((player)=>player.bet_amount<1)} onClick={()=>act({action:"start",tableId:table.id},"Le croupier lance la partie.")} type="button">Lancer la partie</button></>}
          {table.status==="finished"&&table.is_host&&<button className={styles.primaryButton} disabled={pending} onClick={()=>act({action:"new_round",tableId:table.id},"Nouvelle manche : les mises sont ouvertes.")} type="button">Ouvrir une nouvelle manche</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
