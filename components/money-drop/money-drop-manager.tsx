"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addMoneyDropQuestion,
  advanceMoneyDropRound,
  cancelMoneyDropGame,
  createMoneyDropGame,
  lockMoneyDropAllocations,
  openMoneyDropQuestion,
  revealMoneyDropAnswer,
  selectMoneyDropQuestion,
  selectRandomMoneyDropQuestion,
  toggleMoneyDrop,
  toggleMoneyDropQuestion,
  updateMoneyDropSettings,
} from "@/app/actions/money-drop";
import type {
  MoneyDropCitizen,
  MoneyDropQuestion,
  MoneyDropState,
} from "@/lib/money-drop/data";
import styles from "./money-drop.module.css";

function money(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function statusLabel(status: string | undefined) {
  if (status === "setup") return "Question à préparer";
  if (status === "question_open") return "Répartition ouverte";
  if (status === "allocations_locked") return "Mises verrouillées";
  if (status === "revealed") return "Résultat révélé";
  if (status === "finished") return "Partie terminée";
  return "Aucune partie";
}

export function MoneyDropManager({
  state,
  citizens,
  questions,
}: {
  state: MoneyDropState;
  citizens: MoneyDropCitizen[];
  questions: MoneyDropQuestion[];
}) {
  const [playerCount, setPlayerCount] = useState(2);
  const router = useRouter();
  const game = state.game;

  useEffect(() => {
    if (game?.status !== "question_open" && game?.status !== "allocations_locked") {
      return;
    }

    const interval = window.setInterval(() => {
      const active = document.activeElement;
      const editing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;

      if (document.visibilityState === "visible" && !editing) {
        router.refresh();
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [game?.status, router]);
  const activeQuestions = questions.filter((question) => question.active !== false);
  const allocated = Object.values(state.allocations).reduce(
    (total, value) => total + value,
    0,
  );

  return (
    <div className={styles.managerPanel}>
      <header className={styles.managerHeader}>
        <div>
          <span className={styles.eyebrow}>ACCÈS GÉRANT UNIQUEMENT</span>
          <h2>Régie Money Drop</h2>
          <p>
            Le bouton ci-contre contrôle directement la visibilité du jeu côté
            citoyens. Lorsqu’il est coupé, aucune carte Money Drop n’est affichée.
          </p>
        </div>

        {state.configured && (
          <form action={toggleMoneyDrop}>
            <input
              type="hidden"
              name="enabled"
              value={state.settings.enabled ? "false" : "true"}
            />
            <button
              className={state.settings.enabled ? styles.dangerButton : styles.primaryButton}
              type="submit"
            >
              {state.settings.enabled ? "Désactiver Money Drop" : "Activer Money Drop"}
            </button>
          </form>
        )}
      </header>

      {!state.configured ? (
        <section className={styles.managerSection}>
          <span className={styles.eyebrow}>ACTIVATION V138 NÉCESSAIRE</span>
          <h2>Installer le module Money Drop</h2>
          <p>
            Exécute une seule fois le fichier
            <strong> supabase/nostra-v138-money-drop.sql</strong> dans Supabase →
            SQL Editor. Recharge ensuite cette page.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.managerSection}>
            <span className={styles.eyebrow}>PARAMÈTRES GÉNÉRAUX</span>
            <h2>Format de l’émission</h2>
            <form action={updateMoneyDropSettings} className={styles.formGrid}>
              <label>
                <span>Cagnotte de départ</span>
                <input
                  name="starting_amount"
                  type="number"
                  min={1000}
                  max={1_000_000_000}
                  step={1000}
                  defaultValue={state.settings.starting_amount}
                  required
                />
              </label>
              <label>
                <span>Nombre de manches</span>
                <input
                  name="total_rounds"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={state.settings.total_rounds}
                  required
                />
              </label>
              <label>
                <span>Temps par question</span>
                <input
                  name="answer_seconds"
                  type="number"
                  min={10}
                  max={600}
                  defaultValue={state.settings.answer_seconds}
                  required
                />
              </label>
              <button type="submit">Enregistrer les paramètres</button>
            </form>
          </section>

          {!game ? (
            <section className={styles.managerSection}>
              <span className={styles.eyebrow}>NOUVELLE PARTIE</span>
              <h2>Créer l’équipe Money Drop</h2>
              <p>Choisis entre un et quatre citoyens. Le premier sera le capitaine.</p>

              <div className={styles.actionRow}>
                {[1, 2, 3, 4].map((count) => (
                  <button
                    className={playerCount === count ? styles.primaryButton : styles.secondaryButton}
                    key={count}
                    type="button"
                    onClick={() => setPlayerCount(count)}
                  >
                    {count} joueur{count > 1 ? "s" : ""}
                  </button>
                ))}
              </div>

              <form action={createMoneyDropGame} className={styles.formGrid}>
                <input type="hidden" name="player_count" value={playerCount} />
                <label className={styles.fullWidth}>
                  <span>Nom de l’équipe</span>
                  <input name="team_name" type="text" maxLength={100} defaultValue="Équipe Nostra" required />
                </label>
                {Array.from({ length: playerCount }, (_, index) => index + 1).map(
                  (position) => (
                    <label key={position}>
                      <span>
                        Joueur {position}
                        {position === 1 ? " — capitaine" : ""}
                      </span>
                      <select name={`player_${position}`} defaultValue="" required>
                        <option value="" disabled>
                          Choisir un citoyen
                        </option>
                        {citizens.map((citizen) => (
                          <option key={`${position}-${citizen.user_id}`} value={citizen.user_id}>
                            {citizen.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
                <button type="submit">Créer la partie</button>
              </form>
            </section>
          ) : (
            <section className={styles.managerSection}>
              <span className={styles.eyebrow}>PARTIE EN DIRECT</span>
              <h2>{game.team_name}</h2>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span>Cagnotte</span>
                  <strong>{money(game.current_amount)}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Manche</span>
                  <strong>
                    {game.current_round} / {game.total_rounds}
                  </strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>État</span>
                  <strong>{statusLabel(game.status)}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Argent placé</span>
                  <strong>{money(allocated)}</strong>
                </div>
              </div>

              <div className={styles.teamList}>
                {state.players.map((player) => (
                  <div className={styles.playerCard} key={player.user_id}>
                    <strong>{player.player_name}</strong>
                    <span>{player.is_captain ? "Capitaine" : `Joueur ${player.position}`}</span>
                  </div>
                ))}
              </div>

              {game.status === "setup" && (
                <>
                  <form action={selectMoneyDropQuestion} className={styles.formGrid}>
                    <input type="hidden" name="game_id" value={game.id} />
                    <label className={styles.fullWidth}>
                      <span>Question de la manche {game.current_round}</span>
                      <select
                        name="question_id"
                        defaultValue={state.question?.id ? String(state.question.id) : ""}
                        required
                      >
                        <option value="" disabled>
                          Choisir une question active
                        </option>
                        {activeQuestions.map((question) => (
                          <option key={question.id} value={question.id}>
                            [{question.category}] {question.question}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit">Charger cette question</button>
                  </form>

                  <div className={styles.actionRow}>
                    <form action={selectRandomMoneyDropQuestion}>
                      <input type="hidden" name="game_id" value={game.id} />
                      <button type="submit">Tirer une question au hasard</button>
                    </form>
                    <form action={openMoneyDropQuestion}>
                      <input type="hidden" name="game_id" value={game.id} />
                      <button className={styles.primaryButton} type="submit" disabled={!state.question}>
                        Ouvrir la répartition aux joueurs
                      </button>
                    </form>
                  </div>
                </>
              )}

              {state.question && (
                <div className={styles.waiting}>
                  <strong>
                    [{state.question.category}] {state.question.question}
                  </strong>
                  <br />
                  <span>
                    Bonne réponse régie : {state.question.correct_option ?? "cachée"}
                  </span>
                </div>
              )}

              {game.status === "question_open" && (
                <div className={styles.actionRow}>
                  <form action={lockMoneyDropAllocations}>
                    <input type="hidden" name="game_id" value={game.id} />
                    <button className={styles.primaryButton} type="submit">
                      Verrouiller les mises
                    </button>
                  </form>
                  <Link className={styles.secondaryButton} href="/motors/money-drop" target="_blank">
                    Ouvrir l’écran civil
                  </Link>
                </div>
              )}

              {game.status === "allocations_locked" && (
                <div className={styles.actionRow}>
                  <form action={revealMoneyDropAnswer}>
                    <input type="hidden" name="game_id" value={game.id} />
                    <button className={styles.primaryButton} type="submit">
                      Ouvrir les mauvaises trappes
                    </button>
                  </form>
                </div>
              )}

              {game.status === "revealed" && (
                <div className={styles.actionRow}>
                  <form action={advanceMoneyDropRound}>
                    <input type="hidden" name="game_id" value={game.id} />
                    <button className={styles.primaryButton} type="submit">
                      {game.current_round >= game.total_rounds || game.current_amount === 0
                        ? "Terminer la partie"
                        : "Préparer la manche suivante"}
                    </button>
                  </form>
                </div>
              )}

              <div className={styles.actionRow}>
                <form action={cancelMoneyDropGame}>
                  <input type="hidden" name="game_id" value={game.id} />
                  <button className={styles.dangerButton} type="submit">
                    Annuler et fermer la partie
                  </button>
                </form>
              </div>
            </section>
          )}

          <section className={styles.managerSection}>
            <span className={styles.eyebrow}>BANQUE DE QUESTIONS</span>
            <h2>Créer une nouvelle question</h2>
            <p>
              Deux réponses minimum, quatre maximum. La réponse correcte ne sera
              jamais envoyée aux citoyens avant la révélation.
            </p>

            <form action={addMoneyDropQuestion} className={styles.questionForm}>
              <label>
                <span>Catégorie</span>
                <input name="category" type="text" maxLength={100} required />
              </label>
              <label>
                <span>Question</span>
                <textarea name="question" maxLength={500} required />
              </label>
              <label>
                <span>Réponse A</span>
                <input name="option_a" type="text" maxLength={180} required />
              </label>
              <label>
                <span>Réponse B</span>
                <input name="option_b" type="text" maxLength={180} required />
              </label>
              <label>
                <span>Réponse C — facultative</span>
                <input name="option_c" type="text" maxLength={180} />
              </label>
              <label>
                <span>Réponse D — facultative</span>
                <input name="option_d" type="text" maxLength={180} />
              </label>
              <label className={styles.fullWidth}>
                <span>Bonne réponse</span>
                <select name="correct_option" defaultValue="A" required>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>
              <button className={styles.fullWidth} type="submit">
                Ajouter à la banque
              </button>
            </form>

            <div className={styles.questionList}>
              {questions.map((question) => (
                <article className={styles.questionItem} key={question.id}>
                  <span>#{question.id}</span>
                  <div>
                    <strong>
                      [{question.category}] {question.question}
                    </strong>
                    <br />
                    <small>
                      Bonne réponse : {question.correct_option} · {question.options.length} trappes
                    </small>
                  </div>
                  <form action={toggleMoneyDropQuestion}>
                    <input type="hidden" name="question_id" value={question.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={question.active === false ? "true" : "false"}
                    />
                    <button
                      className={question.active === false ? styles.primaryButton : styles.secondaryButton}
                      type="submit"
                    >
                      {question.active === false ? "Réactiver" : "Désactiver"}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
