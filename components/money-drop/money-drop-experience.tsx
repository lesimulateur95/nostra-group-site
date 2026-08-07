"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  joinMoneyDropGame,
  registerMoneyDrop,
  saveMoneyDropAllocations,
  useMoneyDropJoker,
  withdrawMoneyDropRegistration,
} from "@/app/actions/money-drop";
import type { MoneyDropOptionKey, MoneyDropState } from "@/lib/money-drop/data";
import styles from "./money-drop.module.css";

const keys: MoneyDropOptionKey[] = ["A", "B", "C", "D"];

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function statusLabel(status: string | undefined) {
  if (status === "setup") return "Salle d’attente";
  if (status === "question_open") return "Répartition ouverte";
  if (status === "allocations_locked") return "Mises verrouillées";
  if (status === "revealed") return "Réponse révélée";
  if (status === "finished") return "Partie terminée";
  return "En attente de la régie";
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
  if (amount <= 0) return <div className={styles.emptyStack}>Aucune liasse</div>;
  const count = Math.max(1, Math.min(8, Math.ceil((amount / Math.max(1, max)) * 8)));
  return (
    <div className={styles.billStack} aria-label={`${count} liasses virtuelles`}>
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} style={{ "--bill-index": index } as React.CSSProperties}>€</span>
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
    const frequencies = { tick: 520, lock: 220, reveal: 150, win: 760 };
    osc.frequency.value = frequencies[kind];
    osc.type = kind === "win" ? "sine" : "square";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "win" ? 0.55 : 0.18));
    osc.connect(gain); gain.connect(ctx.destination); osc.start();
    osc.stop(ctx.currentTime + (kind === "win" ? 0.6 : 0.2));
    window.setTimeout(() => void ctx.close(), 800);
  } catch { /* son facultatif */ }
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
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible" && !userIsEditing()) router.refresh();
    }, 4000);
    return () => { window.clearInterval(clock); window.clearInterval(refresh); };
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

  function updateAllocation(key: MoneyDropOptionKey, value: string) {
    const parsed = Number(value);
    setAllocations((current) => ({ ...current, [key]: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0 }));
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* plein écran non disponible */ }
  }

  const revealed = game?.status === "revealed" || game?.status === "finished";

  return (
    <main className={`${styles.page} ${spectator ? styles.spectatorPage : ""}`}>
      <section className={styles.hero}>
        <div className={styles.showToolbar}>
          <span className={styles.eyebrow}>NOSTRA MOTORS PRÉSENTE</span>
          <div className={styles.toolbarButtons}>
            {state.settings.sounds_enabled && (
              <button className={styles.iconButton} type="button" onClick={() => setSoundsOn((value) => !value)}>
                {soundsOn ? "🔊 Sons" : "🔇 Sons"}
              </button>
            )}
            <button className={styles.iconButton} type="button" onClick={toggleFullscreen}>⛶ Plein écran</button>
          </div>
        </div>
        <h1>Money Drop</h1>
        <p>Une cagnotte, des trappes, une seule bonne réponse. Tout ce qui tombe est définitivement perdu.</p>

        <div className={styles.heroStats}>
          <div><span>Cagnotte</span><strong>{money(game?.current_amount ?? state.settings.starting_amount)}</strong></div>
          <div><span>Mode</span><strong>{modeLabel(game?.game_mode)}</strong></div>
          <div><span>État</span><strong>{statusLabel(game?.status)}</strong></div>
        </div>
      </section>

      {successMessage && <div className={styles.success}>{successMessage}</div>}
      {errorMessage && <div className={styles.error}>{errorMessage}</div>}

      {!game && state.settings.public_registration_enabled && !spectator && (
        <section className={styles.registrationBanner}>
          <div>
            <span className={styles.eyebrow}>PARTIE PUBLIQUE</span>
            <h2>Les inscriptions Money Drop sont ouvertes</h2>
            <p>Inscris-toi à la file d’attente. La régie choisira ensuite les participants.</p>
          </div>
          {state.current_user_is_registered ? (
            <form action={withdrawMoneyDropRegistration}><button className={styles.secondaryButton}>Se désinscrire</button></form>
          ) : (
            <form action={registerMoneyDrop}><button className={styles.primaryButton}>S’inscrire</button></form>
          )}
        </section>
      )}

      {!game ? (
        <section className={styles.waiting}>
          <h2>Aucune partie en cours</h2>
          <p>La prochaine émission apparaîtra ici dès sa création.</p>
        </section>
      ) : (
        <>
          <section className={styles.teamPanel}>
            <div className={styles.panelTopline}>
              <div><span className={styles.eyebrow}>ÉQUIPE EN JEU</span><h2>{game.team_name}</h2></div>
              <div className={styles.roundPill}>Manche {game.current_round}/{game.total_rounds}</div>
            </div>
            <div className={styles.teamList}>
              {state.players.map((player) => (
                <div className={styles.playerCard} key={player.user_id}>
                  <strong>{player.player_name}</strong>
                  <span>{player.is_captain ? "Capitaine" : `Joueur ${player.position}`}</span>
                </div>
              ))}
            </div>

            {!spectator && !state.current_user_is_player && game.status === "setup" && state.players.length < 4 && (
              <form action={joinMoneyDropGame} className={styles.joinForm}>
                <label><span>Code de partie</span><input name="join_code" type="text" maxLength={8} placeholder="ABC123" required /></label>
                <button className={styles.secondaryButton} type="submit">Rejoindre l’équipe</button>
              </form>
            )}
            {!spectator && state.current_user_is_player && game.join_code && (
              <div className={styles.joinCode}>Code équipe : <strong>{game.join_code}</strong></div>
            )}
          </section>

          <section className={styles.board}>
            {!question ? (
              <div className={styles.waiting}><h2>Salle d’attente</h2><p>La régie prépare la prochaine question.</p></div>
            ) : (
              <>
                <header className={styles.questionHeader}>
                  <div>
                    <span className={styles.eyebrow}>MANCHE {game.current_round} · {question.category} · {question.difficulty}</span>
                    <h2>{question.question}</h2>
                  </div>
                  {remainingSeconds !== null && game.status === "question_open" && (
                    <div className={`${styles.timer} ${remainingSeconds <= 10 ? styles.timerDanger : ""}`}>{remainingSeconds}s</div>
                  )}
                </header>

                <div className={`${styles.doors} ${question.options.length === 2 ? styles.twoDoors : ""}`}>
                  {question.options.map((option) => {
                    const isCorrect = Boolean(revealed && question.correct_option === option.key);
                    const isWrong = Boolean(revealed && question.correct_option !== option.key);
                    const removedByHint = !revealed && game.hint_removed_option === option.key;
                    const className = [styles.door, isCorrect ? styles.doorCorrect : "", isWrong ? styles.doorWrong : "", removedByHint ? styles.doorHintRemoved : ""].filter(Boolean).join(" ");
                    return (
                      <article className={className} key={option.key}>
                        <div className={styles.trapSurface}>
                          <span className={styles.optionKey}>{option.key}</span>
                          <strong className={styles.optionLabel}>{removedByHint ? "ÉLIMINÉE PAR L’INDICE" : option.label}</strong>
                          <BillStack amount={allocations[option.key]} max={amountToPlace} />
                          <div className={styles.moneyStack}><strong>{money(allocations[option.key])}</strong><span>{isCorrect ? "Argent conservé" : isWrong ? "Trappe ouverte" : "Montant posé"}</span></div>
                        </div>
                        {isWrong && allocations[option.key] > 0 && <div className={styles.fallingMoney}>{Array.from({ length: 7 }).map((_, i) => <span key={i}>€</span>)}</div>}
                      </article>
                    );
                  })}
                </div>

                {state.settings.jokers_enabled && game.status === "question_open" && state.current_user_is_player && !spectator && (
                  <div className={styles.jokerBar}>
                    <span className={styles.eyebrow}>JOKERS — UNE UTILISATION PAR PARTIE</span>
                    <div className={styles.actionRow}>
                      <form action={useMoneyDropJoker}><input type="hidden" name="game_id" value={game.id}/><input type="hidden" name="joker" value="time"/><button disabled={game.joker_time_used}>⏱ +30 secondes</button></form>
                      <form action={useMoneyDropJoker}><input type="hidden" name="game_id" value={game.id}/><input type="hidden" name="joker" value="hint"/><button disabled={game.joker_hint_used || game.current_round >= game.total_rounds}>💡 Éliminer une mauvaise trappe</button></form>
                      <form action={useMoneyDropJoker}><input type="hidden" name="game_id" value={game.id}/><input type="hidden" name="joker" value="change"/><button disabled={game.joker_change_used}>🔄 Changer de question</button></form>
                    </div>
                  </div>
                )}

                {game.status === "question_open" && state.current_user_is_player && !spectator && (
                  <form action={saveMoneyDropAllocations} className={styles.allocationForm}>
                    <input type="hidden" name="game_id" value={game.id} />
                    <div className={styles.allocationGrid}>
                      {keys.map((key) => {
                        const option = question.options.find((item) => item.key === key);
                        const disabled = !option || game.hint_removed_option === key;
                        return (
                          <label key={key}><span>Trappe {key}</span><input name={`allocation_${key.toLowerCase()}`} type="number" min={0} max={amountToPlace} step={1000} value={disabled ? 0 : allocations[key]} disabled={disabled} onChange={(event) => updateAllocation(key, event.target.value)} /></label>
                        );
                      })}
                    </div>
                    <div className={styles.allocationSummary}>
                      <span>Reste à placer : <strong>{money(remainingToPlace)}</strong></span>
                      <span>Tu peux miser sur <strong>toutes les trappes</strong>.</span>
                      <button className={styles.primaryButton} type="submit" disabled={!canSubmit}>Valider la répartition</button>
                    </div>
                  </form>
                )}

                {game.status === "question_open" && (!state.current_user_is_player || spectator) && <div className={styles.waiting}>L’équipe répartit actuellement sa cagnotte sur les trappes.</div>}
                {game.status === "allocations_locked" && <div className={styles.lockedBanner}>🔒 MISES VERROUILLÉES — révélation imminente</div>}
                {revealed && question.correct_option && <div className={styles.success}>Bonne réponse : trappe {question.correct_option}. Cagnotte restante : <strong>{money(game.current_amount)}</strong>.</div>}
              </>
            )}
          </section>
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

      {state.recent_games.length > 0 && (
        <section className={styles.historyPanel}>
          <span className={styles.eyebrow}>ARCHIVES MONEY DROP</span>
          <h2>Dernières parties</h2>
          <div className={styles.historyList}>
            {state.recent_games.map((entry) => (
              <article className={styles.historyItem} key={entry.id}>
                <span>🎬</span>
                <div><strong>{entry.team_name}</strong><br/><small>{entry.players || "Équipe Nostra"} · {modeLabel(entry.game_mode)}</small></div>
                <span className={styles.historyAmount}>{money(entry.final_amount)}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {game && state.history.length > 0 && (
        <section className={styles.historyPanel}>
          <span className={styles.eyebrow}>HISTORIQUE DE LA PARTIE</span>
          <h2>Les trappes déjà ouvertes</h2>
          <div className={styles.historyList}>
            {state.history.map((round) => (
              <article className={styles.historyItem} key={round.round_number}><span>#{round.round_number}</span><div><strong>{round.question}</strong><br/><small>Bonne réponse : {round.correct_option} · Perte : {money(round.lost_amount)}</small></div><span className={styles.historyAmount}>{money(round.remaining_amount)}</span></article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
