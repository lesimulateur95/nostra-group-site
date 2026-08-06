"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { saveMoneyDropAllocations } from "@/app/actions/money-drop";
import type {
  MoneyDropOptionKey,
  MoneyDropState,
} from "@/lib/money-drop/data";
import styles from "./money-drop.module.css";

const keys: MoneyDropOptionKey[] = ["A", "B", "C", "D"];

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function statusLabel(status: string | undefined) {
  if (status === "question_open") return "Répartition ouverte";
  if (status === "allocations_locked") return "Mises verrouillées";
  if (status === "revealed") return "Réponse révélée";
  if (status === "finished") return "Partie terminée";
  return "En attente de la régie";
}

function userIsEditing() {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  );
}

export function MoneyDropExperience({
  state,
  successMessage,
  errorMessage,
}: {
  state: MoneyDropState;
  successMessage: string | null;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const game = state.game;
  const question = state.question;
  const [now, setNow] = useState(0);
  const [allocations, setAllocations] = useState(state.allocations);

  useEffect(() => {
    setAllocations(state.allocations);
  }, [
    state.allocations.A,
    state.allocations.B,
    state.allocations.C,
    state.allocations.D,
    game?.id,
    game?.current_round,
  ]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible" && !userIsEditing()) {
        router.refresh();
      }
    }, 5000);

    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [router]);

  const remainingSeconds = game?.round_deadline && now > 0
    ? Math.max(0, Math.ceil((new Date(game.round_deadline).getTime() - now) / 1000))
    : null;

  const totalAllocated = useMemo(
    () => keys.reduce((total, key) => total + allocations[key], 0),
    [allocations],
  );
  const amountToPlace = game?.current_amount ?? 0;
  const remainingToPlace = amountToPlace - totalAllocated;
  const canSubmit =
    game?.status === "question_open" &&
    state.current_user_is_player &&
    remainingToPlace === 0;

  function updateAllocation(key: MoneyDropOptionKey, value: string) {
    const parsed = Number(value);
    setAllocations((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0,
    }));
  }

  if (!game) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>NOSTRA MOTORS PRÉSENTE</span>
          <h1>Money Drop</h1>
          <p>
            La régie prépare la prochaine équipe. Toute la cagnotte devra être
            répartie librement sur une ou plusieurs trappes.
          </p>
        </section>
        <section className={styles.waiting}>
          <h2>Aucune partie en cours</h2>
          <p>La prochaine émission apparaîtra ici dès sa création.</p>
        </section>
      </main>
    );
  }

  const revealed = game.status === "revealed" || game.status === "finished";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>NOSTRA MOTORS PRÉSENTE</span>
        <h1>Money Drop</h1>
        <p>
          L’équipe doit placer l’intégralité de sa cagnotte sur les réponses.
          Une mauvaise trappe s’ouvre et tout l’argent posé dessus disparaît.
        </p>

        <div className={styles.heroStats}>
          <div>
            <span>Cagnotte restante</span>
            <strong>{money(game.current_amount)}</strong>
          </div>
          <div>
            <span>Progression</span>
            <strong>
              {game.current_round} / {game.total_rounds}
            </strong>
          </div>
          <div>
            <span>État</span>
            <strong>{statusLabel(game.status)}</strong>
          </div>
        </div>
      </section>

      {successMessage && <div className={styles.success}>{successMessage}</div>}
      {errorMessage && <div className={styles.error}>{errorMessage}</div>}

      <section className={styles.teamPanel}>
        <span className={styles.eyebrow}>ÉQUIPE EN JEU</span>
        <h2>{game.team_name}</h2>
        <div className={styles.teamList}>
          {state.players.map((player) => (
            <div className={styles.playerCard} key={player.user_id}>
              <strong>{player.player_name}</strong>
              <span>{player.is_captain ? "Capitaine de l’équipe" : "Membre de l’équipe"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.board}>
        {!question ? (
          <div className={styles.waiting}>
            <h2>Question en préparation</h2>
            <p>La régie sélectionne la prochaine question.</p>
          </div>
        ) : (
          <>
            <header className={styles.questionHeader}>
              <div>
                <span className={styles.eyebrow}>
                  MANCHE {game.current_round} · {question.category}
                </span>
                <h2>{question.question}</h2>
              </div>
              {remainingSeconds !== null && game.status === "question_open" && (
                <div className={styles.timer}>{remainingSeconds}s</div>
              )}
            </header>

            <div className={styles.doors}>
              {question.options.map((option) => {
                const isCorrect = revealed && question.correct_option === option.key;
                const isWrong = revealed && question.correct_option !== option.key;
                const className = [
                  styles.door,
                  isCorrect ? styles.doorCorrect : "",
                  isWrong ? styles.doorWrong : "",
                  allocations[option.key] === 0 ? styles.doorEmpty : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <article className={className} key={option.key}>
                    <span className={styles.optionKey}>{option.key}</span>
                    <strong className={styles.optionLabel}>{option.label}</strong>
                    <div className={styles.moneyStack}>
                      <strong>{money(allocations[option.key])}</strong>
                      <span>
                        {isCorrect
                          ? "Argent conservé"
                          : isWrong
                            ? "Trappe ouverte"
                            : "Montant posé"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {game.status === "question_open" && state.current_user_is_player && (
              <form action={saveMoneyDropAllocations} className={styles.allocationForm}>
                <input type="hidden" name="game_id" value={game.id} />
                <div className={styles.allocationGrid}>
                  {keys.map((key) => {
                    const option = question.options.find((item) => item.key === key);
                    return (
                      <label key={key}>
                        <span>Trappe {key}</span>
                        <input
                          name={`allocation_${key.toLowerCase()}`}
                          type="number"
                          min={0}
                          max={amountToPlace}
                          step={1000}
                          value={option ? allocations[key] : 0}
                          disabled={!option}
                          onChange={(event) => updateAllocation(key, event.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>

                <div className={styles.allocationSummary}>
                  <span>
                    Reste à placer : <strong>{money(remainingToPlace)}</strong>
                  </span>
                  <span>
                    Répartition libre : <strong>toutes les trappes peuvent recevoir une mise</strong>
                  </span>
                  <button className={styles.primaryButton} type="submit" disabled={!canSubmit}>
                    Valider la répartition
                  </button>
                </div>
              </form>
            )}

            {game.status === "question_open" && !state.current_user_is_player && (
              <div className={styles.waiting}>
                L’équipe place actuellement sa cagnotte sur les trappes.
              </div>
            )}

            {game.status === "allocations_locked" && (
              <div className={styles.waiting}>
                Les mises sont verrouillées. La régie va révéler la bonne réponse.
              </div>
            )}

            {revealed && question.correct_option && (
              <div className={styles.success}>
                La bonne réponse était la trappe {question.correct_option}. La cagnotte restante est de {money(game.current_amount)}.
              </div>
            )}
          </>
        )}
      </section>

      {state.history.length > 0 && (
        <section className={styles.historyPanel}>
          <span className={styles.eyebrow}>HISTORIQUE DE LA PARTIE</span>
          <h2>Les trappes déjà ouvertes</h2>
          <div className={styles.historyList}>
            {state.history.map((round) => (
              <article className={styles.historyItem} key={round.round_number}>
                <span>#{round.round_number}</span>
                <div>
                  <strong>{round.question}</strong>
                  <br />
                  <small>Bonne réponse : {round.correct_option} · Perte : {money(round.lost_amount)}</small>
                </div>
                <span className={styles.historyAmount}>{money(round.remaining_amount)}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
