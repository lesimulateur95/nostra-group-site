"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addMoneyDropQuestion,
  createMoneyDropGameFromRegistrations,
  advanceMoneyDropRound,
  cancelMoneyDropGame,
  createMoneyDropGame,
  lockMoneyDropAllocations,
  revealMoneyDropAnswer,
  selectMoneyDropQuestion,
  selectRandomMoneyDropQuestion,
  startMoneyDropRound,
  toggleMoneyDrop,
  toggleMoneyDropRegistrations,
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
  if (status === "setup") return "Prête à lancer";
  if (status === "question_open") return "Répartition ouverte";
  if (status === "allocations_locked") return "Mises verrouillées";
  if (status === "revealed") return "Résultat révélé";
  if (status === "finished") return "Partie terminée";
  return "Aucune partie";
}

const ALL_THEMES = "Tous les thèmes";

const MONEY_DROP_THEMES = [
  "Automobile",
  "Culture générale",
  "Géographie",
  "Histoire",
  "Sciences",
  "Espace",
  "Technologie",
  "Sport",
  "Football",
  "Cinéma & séries",
  "Musique",
  "Cuisine",
  "Nature",
  "Animaux",
  "Logique & maths",
  "Jeux de société",
  "Jeux vidéo",
  "Littérature & français",
  "Mythologie",
  "France & patrimoine",
] as const;

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
  const [questionTheme, setQuestionTheme] = useState(ALL_THEMES);
  const [questionBankType, setQuestionBankType] = useState<"standard" | "final">("standard");
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
  const defaultThemes = new Set<string>(MONEY_DROP_THEMES);
  const extraThemes = questions
    .map((question) => question.category)
    .filter((category) => !defaultThemes.has(category));
  const themes = [...MONEY_DROP_THEMES, ...Array.from(new Set(extraThemes)).sort()];
  const sortedQuestions = [...questions].sort((a, b) =>
    Number(a.is_final === true) - Number(b.is_final === true) ||
    a.category.localeCompare(b.category, "fr") ||
    a.question.localeCompare(b.question, "fr"),
  );
  const activeQuestions = sortedQuestions.filter(
    (question) => question.active !== false,
  );
  const standardQuestions = sortedQuestions.filter((question) => question.is_final !== true);
  const finalQuestions = sortedQuestions.filter((question) => question.is_final === true);
  const bankQuestions = questionBankType === "final" ? finalQuestions : standardQuestions;
  const activeBankQuestions = bankQuestions.filter((question) => question.active !== false);
  const bankThemes = themes.filter((theme) =>
    bankQuestions.some((question) => question.category === theme),
  );
  const visibleQuestions =
    questionTheme === ALL_THEMES
      ? bankQuestions
      : bankQuestions.filter((question) => question.category === questionTheme);
  const isFinalRound = Boolean(game && game.current_round >= game.total_rounds);
  const roundQuestions = activeQuestions.filter(
    (question) => (question.is_final === true) === isFinalRound,
  );
  const roundThemes = themes.filter((theme) =>
    roundQuestions.some((question) => question.category === theme),
  );
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
              <label className={styles.toggleLabel}>
                <input name="public_registration_enabled" type="checkbox" defaultChecked={state.settings.public_registration_enabled} />
                <span>Inscriptions publiques</span>
              </label>
              <label className={styles.toggleLabel}>
                <input name="spectator_enabled" type="checkbox" defaultChecked={state.settings.spectator_enabled} />
                <span>Écran spectateur</span>
              </label>
              <label className={styles.toggleLabel}>
                <input name="sounds_enabled" type="checkbox" defaultChecked={state.settings.sounds_enabled} />
                <span>Sons et tension</span>
              </label>
              <label className={styles.toggleLabel}>
                <input name="jokers_enabled" type="checkbox" defaultChecked={state.settings.jokers_enabled} />
                <span>Jokers</span>
              </label>
              <button type="submit">Enregistrer les paramètres</button>
            </form>
          </section>

          <section className={styles.managerSection}>
            <div className={styles.managerHeader}>
              <div>
                <span className={styles.eyebrow}>INSCRIPTIONS PUBLIQUES</span>
                <h2>File d’attente Money Drop</h2>
                <p>Quand elle est ouverte, les citoyens s’inscrivent depuis Jeux & événements → Money Drop.</p>
              </div>
              <div className={styles.actionRow}>
                <Link className={styles.secondaryButton} href="/evenements/jeux/money-drop/inscription" target="_blank">Voir la page d’inscription</Link>
                <form action={toggleMoneyDropRegistrations}>
                  <input type="hidden" name="enabled" value={state.settings.public_registration_enabled ? "false" : "true"} />
                  <button className={state.settings.public_registration_enabled ? styles.dangerButton : styles.primaryButton} type="submit">
                    {state.settings.public_registration_enabled ? "Fermer les inscriptions" : "Ouvrir les inscriptions"}
                  </button>
                </form>
              </div>
            </div>

            <div className={styles.bankStats}>
              <div><span>Inscrits</span><strong>{state.registrations.length}</strong></div>
              <div><span>État</span><strong>{state.settings.public_registration_enabled ? "OUVERT" : "FERMÉ"}</strong></div>
            </div>

            {!game && state.registrations.length > 0 && (
              <form action={createMoneyDropGameFromRegistrations} className={styles.registrationManager}>
                <div className={styles.formGrid}>
                  <label><span>Nom de l’équipe</span><input name="team_name" defaultValue="Équipe Événement" required /></label>
                  <label><span>Mode</span><select name="game_mode" defaultValue="event"><option value="event">Événement</option><option value="classic">Classique</option><option value="express">Express</option></select></label>
                </div>
                <div className={styles.registrationList}>
                  {state.registrations.map((registration) => (
                    <label key={registration.user_id} className={styles.registrationChoice}>
                      <input type="checkbox" name="registered_player" value={registration.user_id} />
                      <span><strong>{registration.player_name}</strong><small>Inscrit à la file d’attente</small></span>
                    </label>
                  ))}
                </div>
                <button className={styles.primaryButton} type="submit">Créer une équipe avec les citoyens cochés</button>
              </form>
            )}
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
                <label>
                  <span>Mode de jeu</span>
                  <select name="game_mode" defaultValue="classic">
                    <option value="classic">Classique</option>
                    <option value="express">Express — 5 manches / 30 s max</option>
                    <option value="event">Événement — classement public</option>
                  </select>
                </label>
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
                <div className={styles.summaryCard}>
                  <span>Mode</span>
                  <strong>{game.game_mode === "express" ? "Express" : game.game_mode === "event" ? "Événement" : "Classique"}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span>Code équipe</span>
                  <strong>{game.join_code ?? "—"}</strong>
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

              <div className={styles.managerLaunchStrip}>
                <div>
                  <span className={styles.eyebrow}>ÉCRANS PUBLICS</span>
                  <p>Le jeu et les inscriptions sont uniquement dans Jeux & événements.</p>
                </div>
                <div className={styles.actionRow}>
                  <Link className={styles.secondaryButton} href="/evenements/jeux/money-drop" target="_blank">Écran joueur</Link>
                  <Link className={styles.secondaryButton} href="/evenements/jeux/money-drop/inscription" target="_blank">Inscriptions</Link>
                  {state.settings.spectator_enabled && <Link className={styles.secondaryButton} href="/evenements/jeux/money-drop/spectateur" target="_blank">Spectateur</Link>}
                </div>
              </div>

              {game.status === "setup" && (
                <>
                  <div className={styles.launchGuide}>
                    <strong>Prêt à démarrer</strong>
                    <span>Tu peux choisir une question ci-dessous, ou cliquer directement sur « Lancer la partie » : le site tirera automatiquement une question adaptée et démarrera le chrono.</span>
                  </div>
                  <form action={selectMoneyDropQuestion} className={styles.formGrid}>
                    <input type="hidden" name="game_id" value={game.id} />
                    <label className={styles.fullWidth}>
                      <span>
                        {isFinalRound
                          ? `Question finale — manche ${game.current_round}`
                          : `Question de la manche ${game.current_round}`}
                      </span>
                      <select
                        name="question_id"
                        defaultValue={state.question?.id ? String(state.question.id) : ""}
                        required
                      >
                        <option value="" disabled>
                          Choisir une question active
                        </option>
                        {roundThemes.map((theme) => {
                          const themeQuestions = roundQuestions.filter(
                            (question) => question.category === theme,
                          );
                          if (themeQuestions.length === 0) return null;

                          return (
                            <optgroup
                              key={theme}
                              label={`${theme} — ${themeQuestions.length} question${themeQuestions.length > 1 ? "s" : ""}`}
                            >
                              {themeQuestions.map((question) => (
                                <option key={question.id} value={question.id}>
                                  [{question.difficulty}] {question.question}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </label>
                    <button type="submit">Charger cette question</button>
                  </form>

                  <div className={styles.actionRow}>
                    <form
                      action={selectRandomMoneyDropQuestion}
                      className={styles.randomThemeForm}
                    >
                      <input type="hidden" name="game_id" value={game.id} />
                      <select name="category" defaultValue="">
                        <option value="">Tous les thèmes</option>
                        {roundThemes.map((theme) => (
                          <option key={theme} value={theme}>
                            {theme}
                          </option>
                        ))}
                      </select>
                      <button type="submit">{isFinalRound ? "Tirer une finale au hasard" : "Tirer au hasard dans ce thème"}</button>
                    </form>
                    <form action={startMoneyDropRound}>
                      <input type="hidden" name="game_id" value={game.id} />
                      <button className={styles.launchButton} type="submit">
                        ▶ {game.current_round === 1 ? "LANCER LA PARTIE" : `LANCER LA MANCHE ${game.current_round}`}
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
                    {game.status === "finished" ? "Archiver la partie" : "Annuler et fermer la partie"}
                  </button>
                </form>
              </div>
            </section>
          )}

          <section className={styles.managerSection}>
            <span className={styles.eyebrow}>BANQUE DE QUESTIONS</span>
            <h2>250 questions classées par thèmes</h2>
            <p>
              La banque contient 200 questions classiques et 50 questions finales
              plus difficiles. Les finales utilisent deux trappes et sont proposées
              uniquement pendant la dernière manche.
            </p>

            <div className={styles.bankStats}>
              <div>
                <span>Total</span>
                <strong>{questions.length}</strong>
              </div>
              <div>
                <span>Classiques</span>
                <strong>{standardQuestions.length}</strong>
              </div>
              <div>
                <span>Finales</span>
                <strong>{finalQuestions.length}</strong>
              </div>
              <div>
                <span>Actives</span>
                <strong>{activeQuestions.length}</strong>
              </div>
            </div>

            <div className={styles.actionRow}>
              <button
                className={questionBankType === "standard" ? styles.primaryButton : styles.secondaryButton}
                type="button"
                onClick={() => {
                  setQuestionBankType("standard");
                  setQuestionTheme(ALL_THEMES);
                }}
              >
                Questions classiques ({standardQuestions.length})
              </button>
              <button
                className={questionBankType === "final" ? styles.primaryButton : styles.secondaryButton}
                type="button"
                onClick={() => {
                  setQuestionBankType("final");
                  setQuestionTheme(ALL_THEMES);
                }}
              >
                Questions finales ({finalQuestions.length})
              </button>
            </div>

            <div className={styles.themeGrid}>
              <button
                className={
                  questionTheme === ALL_THEMES
                    ? styles.themeButtonActive
                    : styles.themeButton
                }
                type="button"
                onClick={() => setQuestionTheme(ALL_THEMES)}
              >
                <span>{ALL_THEMES}</span>
                <strong>{bankQuestions.length}</strong>
              </button>
              {bankThemes.map((theme) => {
                const total = bankQuestions.filter(
                  (question) => question.category === theme,
                ).length;
                const active = activeBankQuestions.filter(
                  (question) => question.category === theme,
                ).length;

                return (
                  <button
                    className={
                      questionTheme === theme
                        ? styles.themeButtonActive
                        : styles.themeButton
                    }
                    key={theme}
                    type="button"
                    onClick={() => setQuestionTheme(theme)}
                  >
                    <span>{theme}</span>
                    <strong>
                      {active}/{total}
                    </strong>
                  </button>
                );
              })}
            </div>

            <h3>Créer une nouvelle question</h3>

            <form action={addMoneyDropQuestion} className={styles.questionForm}>
              <label>
                <span>Type de question</span>
                <select name="is_final" defaultValue="false" required>
                  <option value="false">Question classique</option>
                  <option value="true">Question finale</option>
                </select>
              </label>
              <label>
                <span>Difficulté</span>
                <select name="difficulty" defaultValue="Moyenne" required>
                  <option value="Facile">Facile</option>
                  <option value="Moyenne">Moyenne</option>
                  <option value="Difficile">Difficile</option>
                  <option value="Expert">Expert</option>
                  <option value="Finale">Finale</option>
                </select>
              </label>
              <label>
                <span>Thème</span>
                <select name="category" defaultValue="Culture générale" required>
                  {themes.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
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

            <div className={styles.questionListHeader}>
              <div>
                <span className={styles.eyebrow}>THÈME AFFICHÉ</span>
                <h3>
                  {questionBankType === "final" ? "Finales" : "Classiques"} — {questionTheme}
                </h3>
              </div>
              <strong>
                {visibleQuestions.length} question
                {visibleQuestions.length > 1 ? "s" : ""}
              </strong>
            </div>

            <div className={styles.questionList}>
              {visibleQuestions.map((question) => (
                <article className={styles.questionItem} key={question.id}>
                  <span>#{question.id}</span>
                  <div>
                    <span className={styles.themeBadge}>
                      {question.is_final ? "Finale · " : ""}{question.category} · {question.difficulty}
                    </span>
                    <strong>{question.question}</strong>
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
