"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  joinMoneyDropGame,
  saveMoneyDropAllocations,
  useMoneyDropJoker,
} from "@/app/actions/money-drop";
import type { MoneyDropOption, MoneyDropOptionKey, MoneyDropState } from "@/lib/money-drop/data";
import styles from "./money-drop.module.css";

const keys: MoneyDropOptionKey[] = ["A", "B", "C", "D"];
const stages = ["PRÉPARATION", "PLACEMENT", "VERROUILLAGE", "RÉVÉLATION"];

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function statusLabel(status: string | undefined) {
  if (status === "setup") return "Préparation";
  if (status === "question_open") return "Placement des liasses";
  if (status === "allocations_locked") return "Mises verrouillées";
  if (status === "revealed") return "Révélation";
  if (status === "finished") return "Partie terminée";
  return "En attente";
}

function stageIndex(status: string | undefined) {
  if (status === "question_open") return 1;
  if (status === "allocations_locked") return 2;
  if (status === "revealed" || status === "finished") return 3;
  return 0;
}

function modeLabel(mode: string | undefined) {
  if (mode === "express") return "Express";
  if (mode === "event") return "Événement";
  return "Classique";
}

function userIsEditing() {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
}

function BillStack({ amount, max }: { amount: number; max: number }) {
  if (amount <= 0) return <div className={styles.emptyStack}>0 LIASSE</div>;
  const count = Math.max(1, Math.min(10, Math.ceil((amount / Math.max(1, max)) * 10)));
  return (
    <div className={styles.billStack} aria-label={`${count} liasses virtuelles`}>
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} style={{ "--bill-index": index } as CSSProperties}>
          <b>€</b><i>NOSTRA</i>
        </span>
      ))}
    </div>
  );
}

function playTone(kind: "tick" | "lock" | "reveal" | "win") {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const frequencies = { tick: 560, lock: 210, reveal: 135, win: 820 };
    osc.frequency.value = frequencies[kind];
    osc.type = kind === "win" ? "sine" : "square";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "win" ? 0.6 : 0.2));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === "win" ? 0.65 : 0.22));
    window.setTimeout(() => void ctx.close(), 850);
  } catch {
    // Le son reste facultatif et ne doit jamais bloquer le jeu.
  }
}

function Door({
  option,
  allocation,
  max,
  revealed,
  correctOption,
  removedByHint,
  editable,
  onChange,
}: {
  option: MoneyDropOption;
  allocation: number;
  max: number;
  revealed: boolean;
  correctOption: MoneyDropOptionKey | null;
  removedByHint: boolean;
  editable: boolean;
  onChange: (key: MoneyDropOptionKey, value: string) => void;
}) {
  const isCorrect = revealed && correctOption === option.key;
  const isWrong = revealed && correctOption !== option.key;
  const className = [
    styles.tvDoor,
    isCorrect ? styles.tvDoorCorrect : "",
    isWrong ? styles.tvDoorWrong : "",
    removedByHint ? styles.tvDoorHint : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={className}>
      <div className={styles.answerScreen}>
        <span className={styles.answerLetter}>{option.key}</span>
        <strong>{removedByHint ? "TRAPPE ÉLIMINÉE" : option.label}</strong>
      </div>

      <div className={styles.cashPlatform}>
        <BillStack amount={allocation} max={max} />
        <div className={styles.cashAmount}>{money(allocation)}</div>
      </div>

      <div className={styles.trapDoorPanel}>
        <span>TRAPPE {option.key}</span>
        <i />
      </div>

      {editable && (
        <label className={styles.doorInput}>
          <span>Montant à poser</span>
          <input
            name={`allocation_${option.key.toLowerCase()}`}
            type="number"
            min={0}
            max={max}
            step={1000}
            value={removedByHint ? 0 : allocation}
            disabled={removedByHint}
            onChange={(event) => onChange(option.key, event.target.value)}
          />
        </label>
      )}

      {isCorrect && <div className={styles.resultRibbon}>✓ ARGENT SAUVÉ</div>}
      {isWrong && <div className={styles.resultRibbon}>TRAPPE OUVERTE</div>}
      {isWrong && allocation > 0 && (
        <div className={styles.fallingMoney}>
          {Array.from({ length: 10 }).map((_, index) => <span key={index}>€</span>)}
        </div>
      )}
    </article>
  );
}

function JokerDock({ state }: { state: MoneyDropState }) {
  const game = state.game;
  if (!game || !state.settings.jokers_enabled) return null;
  const live = game.status === "question_open";
  const isPlayer = state.current_user_is_player;
  const finalRound = game.current_round >= game.total_rounds;

  const Joker = ({ type, icon, title, used, unavailable = false }: { type: string; icon: string; title: string; used: boolean; unavailable?: boolean }) => (
    <form action={useMoneyDropJoker} className={styles.jokerCard}>
      <input type="hidden" name="game_id" value={game.id} />
      <input type="hidden" name="joker" value={type} />
      <span>{icon}</span>
      <div><strong>{title}</strong><small>{used ? "UTILISÉ" : !isPlayer ? "RÉSERVÉ À L’ÉQUIPE" : !live ? "DISPONIBLE AU LANCEMENT" : unavailable ? "INDISPONIBLE" : "DISPONIBLE"}</small></div>
      <button type="submit" disabled={!isPlayer || !live || used || unavailable}>{used ? "Utilisé" : "Activer"}</button>
    </form>
  );

  return (
    <section className={styles.jokerDock}>
      <div className={styles.jokerDockTitle}><span>JOKERS</span><small>1 utilisation de chaque joker par partie</small></div>
      <div className={styles.jokerGrid}>
        <Joker type="time" icon="+30" title="Temps supplémentaire" used={game.joker_time_used} />
        <Joker type="hint" icon="?" title="Éliminer une mauvaise trappe" used={game.joker_hint_used} unavailable={finalRound} />
        <Joker type="change" icon="↻" title="Changer de question" used={game.joker_change_used} />
      </div>
    </section>
  );
}

export function MoneyDropExperience({
  state,
  successMessage,
  errorMessage,
  spectator = false,
}: {
  state: MoneyDropState;
  successMessage: string | null;
  errorMessage: string | null;
  spectator?: boolean;
}) {
  const router = useRouter();
  const game = state.game;
  const question = state.question;
  const [now, setNow] = useState(0);
  const [allocations, setAllocations] = useState(state.allocations);
  const [soundsOn, setSoundsOn] = useState(state.settings.sounds_enabled);
  const pageRef = useRef<HTMLElement | null>(null);
  const previousStatus = useRef(game?.status);
  const lastTickSecond = useRef<number | null>(null);

  useEffect(() => {
    setAllocations(state.allocations);
  }, [state.allocations.A, state.allocations.B, state.allocations.C, state.allocations.D, game?.id, game?.current_round]);

  useEffect(() => {
    if (!game?.hint_removed_option) return;
    setAllocations((current) => ({ ...current, [game.hint_removed_option as MoneyDropOptionKey]: 0 }));
  }, [game?.hint_removed_option]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 500);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible" && !userIsEditing()) router.refresh();
    }, 2500);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [router]);

  useEffect(() => {
    if (!soundsOn || !game?.status || previousStatus.current === game.status) return;
    if (game.status === "allocations_locked") playTone("lock");
    if (game.status === "revealed") playTone(game.current_amount > 0 ? "win" : "reveal");
    previousStatus.current = game.status;
  }, [game?.status, game?.current_amount, soundsOn]);

  const remainingSeconds = game?.round_deadline && now > 0
    ? Math.max(0, Math.ceil((new Date(game.round_deadline).getTime() - now) / 1000))
    : null;

  useEffect(() => {
    if (!soundsOn || remainingSeconds == null || remainingSeconds > 10 || remainingSeconds <= 0 || lastTickSecond.current === remainingSeconds) return;
    lastTickSecond.current = remainingSeconds;
    playTone("tick");
  }, [remainingSeconds, soundsOn]);

  const totalAllocated = useMemo(() => keys.reduce((total, key) => total + allocations[key], 0), [allocations]);
  const amountToPlace = game?.current_amount ?? 0;
  const remainingToPlace = amountToPlace - totalAllocated;
  const canSubmit = game?.status === "question_open" && state.current_user_is_player && remainingToPlace === 0;
  const revealed = game?.status === "revealed" || game?.status === "finished";
  const activeStage = stageIndex(game?.status);

  function updateAllocation(key: MoneyDropOptionKey, value: string) {
    const parsed = Number(value);
    setAllocations((current) => ({ ...current, [key]: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0 }));
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && pageRef.current) await pageRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Le plein écran est une amélioration facultative.
    }
  }

  function renderDoors(editable: boolean): ReactNode {
    if (!question) return null;
    return (
      <div className={`${styles.tvDoors} ${question.options.length === 2 ? styles.tvDoorsFinal : ""}`}>
        {question.options.map((option) => (
          <Door
            key={option.key}
            option={option}
            allocation={allocations[option.key]}
            max={amountToPlace}
            revealed={revealed}
            correctOption={question.correct_option}
            removedByHint={!revealed && game?.hint_removed_option === option.key}
            editable={editable}
            onChange={updateAllocation}
          />
        ))}
      </div>
    );
  }

  return (
    <main ref={pageRef} className={`${styles.tvPage} ${spectator ? styles.spectatorPage : ""}`}>
      <div className={styles.stageGlow} aria-hidden="true"><i /><i /><i /><i /><i /></div>

      <header className={styles.tvHeader}>
        <div className={styles.liveIdentity}>
          <span className={styles.broadcastBadge}>{spectator ? "ÉCRAN SPECTATEUR" : "JEUX & ÉVÉNEMENTS"}</span>
          <div className={styles.wordmark}><span>MONEY</span><strong>DROP</strong></div>
          <p>Place toute la cagnotte. Une seule trappe peut tout sauver.</p>
        </div>
        <div className={styles.tvTools}>
          {game && <span className={styles.livePill}><i /> {game.status === "finished" ? "TERMINÉ" : "EN DIRECT"}</span>}
          {state.settings.sounds_enabled && <button type="button" onClick={() => setSoundsOn((value) => !value)}>{soundsOn ? "🔊 SON" : "🔇 SON"}</button>}
          <button type="button" onClick={toggleFullscreen}>⛶ PLEIN ÉCRAN</button>
        </div>
      </header>

      {successMessage && <div className={styles.success}>{successMessage}</div>}
      {errorMessage && <div className={styles.error}>{errorMessage}</div>}

      {!game ? (
        <section className={styles.tvLobby}>
          <div className={styles.lobbyLogo}>€</div>
          <span className={styles.eyebrow}>PROCHAINE ÉMISSION</span>
          <h1>Le plateau est prêt.</h1>
          <p>La partie apparaîtra ici dès que la régie aura sélectionné une équipe.</p>
          {!spectator && (
            <div className={styles.lobbyActions}>
              {state.settings.public_registration_enabled && <Link className={styles.primaryButton} href="/evenements/jeux/money-drop/inscription">S’inscrire à la prochaine partie</Link>}
              <Link className={styles.secondaryButton} href="/evenements/jeux">Retour aux Jeux & événements</Link>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className={styles.scoreTower}>
            <div className={styles.jackpotBlock}>
              <span>CAGNOTTE EN JEU</span>
              <strong>{money(game.current_amount)}</strong>
              <small>Départ : {money(game.starting_amount)}</small>
            </div>
            <div className={styles.roundBlock}>
              <span>MANCHE</span>
              <strong>{game.current_round}<i>/</i>{game.total_rounds}</strong>
              <small>{modeLabel(game.game_mode)}</small>
            </div>
            <div className={styles.statusBlock}>
              <span>PHASE</span>
              <strong>{statusLabel(game.status)}</strong>
              <small>{question ? `${question.category} · ${question.difficulty}` : "La régie prépare la question"}</small>
            </div>
            <div className={`${styles.clockBlock} ${game.status === "question_open" && remainingSeconds !== null && remainingSeconds <= 10 ? styles.clockDanger : ""}`}>
              <span>CHRONO</span>
              <strong>{game.status === "question_open" && remainingSeconds !== null ? String(remainingSeconds).padStart(2, "0") : game.status === "allocations_locked" ? "LOCK" : game.status === "revealed" ? "OK" : game.status === "finished" ? "FIN" : "--"}</strong>
              <small>{game.status === "question_open" ? "secondes" : statusLabel(game.status)}</small>
            </div>
          </section>

          <section className={styles.stageProgress}>
            {stages.map((stage, index) => (
              <div key={stage} className={index <= activeStage ? styles.stageStepActive : styles.stageStep}>
                <span>{index + 1}</span><strong>{stage}</strong>
              </div>
            ))}
          </section>

          <section className={styles.teamStrip}>
            <div className={styles.teamName}><span>ÉQUIPE</span><strong>{game.team_name}</strong></div>
            <div className={styles.playerChips}>
              {state.players.map((player) => <span key={player.user_id}><b>{player.player_name}</b><small>{player.is_captain ? "CAPITAINE" : `JOUEUR ${player.position}`}</small></span>)}
            </div>
            {!spectator && state.current_user_is_player && game.join_code && game.status === "setup" && <div className={styles.teamCode}>CODE <strong>{game.join_code}</strong></div>}
          </section>

          {!spectator && !state.current_user_is_player && game.status === "setup" && state.players.length < 4 && (
            <section className={styles.joinPanel}>
              <div><span className={styles.eyebrow}>REJOINDRE L’ÉQUIPE</span><p>Entre le code communiqué par le capitaine ou la régie.</p></div>
              <form action={joinMoneyDropGame}>
                <input name="join_code" type="text" maxLength={8} placeholder="ABC123" required />
                <button className={styles.primaryButton} type="submit">Rejoindre</button>
              </form>
            </section>
          )}

          <section className={styles.tvBoard}>
            {!question ? (
              <div className={styles.preShowScreen}>
                <div className={styles.preShowPulse}>€</div>
                <span className={styles.eyebrow}>PRÉPARATION DE LA MANCHE {game.current_round}</span>
                <h2>La régie prépare la prochaine question.</h2>
                <p>La partie démarrera automatiquement sur cet écran dès que la régie appuiera sur « Lancer la manche ».</p>
              </div>
            ) : (
              <>
                <header className={styles.tvQuestion}>
                  <div className={styles.questionMeta}><span>MANCHE {game.current_round}</span><span>{question.category}</span><span>{question.difficulty}</span></div>
                  <h1>{question.question}</h1>
                  {game.status === "setup" && <div className={styles.readyBanner}>QUESTION CHARGÉE · EN ATTENTE DU LANCEMENT RÉGIE</div>}
                </header>

                {game.status === "question_open" && state.current_user_is_player && !spectator ? (
                  <form action={saveMoneyDropAllocations} className={styles.playForm}>
                    <input type="hidden" name="game_id" value={game.id} />
                    {renderDoors(true)}
                    {keys.filter((key) => !question.options.some((option) => option.key === key)).map((key) => <input key={key} type="hidden" name={`allocation_${key.toLowerCase()}`} value="0" />)}
                    <div className={styles.cashControl}>
                      <div><span>PLACÉ</span><strong>{money(totalAllocated)}</strong></div>
                      <div className={remainingToPlace === 0 ? styles.cashReady : styles.cashRemaining}><span>RESTE À PLACER</span><strong>{money(remainingToPlace)}</strong></div>
                      <p>Tu peux répartir l’argent sur une, plusieurs ou toutes les trappes.</p>
                      <button className={styles.lockBetButton} type="submit" disabled={!canSubmit}>🔒 VERROUILLER MA RÉPARTITION</button>
                    </div>
                  </form>
                ) : (
                  renderDoors(false)
                )}

                {game.status === "question_open" && (!state.current_user_is_player || spectator) && <div className={styles.broadcastMessage}>L’ÉQUIPE PLACE ACTUELLEMENT SES LIASSES…</div>}
                {game.status === "allocations_locked" && <div className={styles.revealMessage}>🔒 MISES VERROUILLÉES <strong>LA RÉVÉLATION ARRIVE…</strong></div>}
                {revealed && question.correct_option && <div className={styles.winMessage}>TRAPPE {question.correct_option} · CAGNOTTE RESTANTE <strong>{money(game.current_amount)}</strong></div>}
              </>
            )}
          </section>

          {!spectator && <JokerDock state={state} />}

          {!spectator && (
            <section className={styles.publicNav}>
              <Link href="/evenements/jeux/money-drop/inscription">Inscriptions</Link>
              {state.settings.spectator_enabled && <Link href="/evenements/jeux/money-drop/spectateur">Écran spectateur</Link>}
              <Link href="/evenements/jeux">Jeux & événements</Link>
            </section>
          )}
        </>
      )}

      {state.leaderboard.length > 0 && (
        <section className={styles.historyPanel}>
          <span className={styles.eyebrow}>CLASSEMENT MONEY DROP</span>
          <h2>Les plus grosses cagnottes sauvées</h2>
          <div className={styles.leaderboard}>
            {state.leaderboard.map((entry, index) => (
              <article key={entry.id}><span className={styles.rank}>#{index + 1}</span><div><strong>{entry.team_name}</strong><small>{entry.players || "Équipe Nostra"} · {modeLabel(entry.game_mode)}</small></div><strong>{money(entry.final_amount)}</strong></article>
            ))}
          </div>
        </section>
      )}

      {game && state.history.length > 0 && (
        <section className={styles.historyPanel}>
          <span className={styles.eyebrow}>HISTORIQUE DE LA PARTIE</span>
          <h2>Les manches déjà jouées</h2>
          <div className={styles.historyList}>
            {state.history.map((round) => (
              <article className={styles.historyItem} key={round.round_number}><span>#{round.round_number}</span><div><strong>{round.question}</strong><br /><small>Bonne réponse : {round.correct_option} · Perte : {money(round.lost_amount)}</small></div><span className={styles.historyAmount}>{money(round.remaining_amount)}</span></article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
