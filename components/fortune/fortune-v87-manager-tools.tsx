"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  addFortunePuzzleV87,
  createFortuneGameAutoV87,
  revealFortuneLetterV87,
  toggleFortunePuzzleV87,
  updateFortuneSpecialSegmentV87,
  useRandomFortunePuzzleV87,
} from "@/app/actions/fortune-v87";
import type { FortuneState } from "@/lib/fortune/data";
import type {
  FortunePuzzleBankItemV87,
  FortuneSegmentV87,
} from "@/lib/fortune/v87-data";
import styles from "./fortune-v87.module.css";

type ToolView = "partie" | "enigmes" | "lettres" | "cases" | "television";

export function FortuneV87ManagerTools({
  state,
  puzzles,
  segments,
}: {
  state: FortuneState;
  puzzles: FortunePuzzleBankItemV87[];
  segments: FortuneSegmentV87[];
}) {
  const [view, setView] = useState<ToolView>(
    state.game ? "enigmes" : "partie",
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState<number>(
    segments.find((segment) => segment.wheel_type === "normal")?.id ?? 0,
  );

  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === selectedSegmentId) ?? null,
    [segments, selectedSegmentId],
  );

  return (
    <section className={styles.managerTools}>
      <div className={styles.sectionHeading}>
        <div>
          <span>RÉGIE V87</span>
          <h2>Nouveaux outils de la Roue de la Fortune</h2>
        </div>
        <strong>Direction uniquement</strong>
      </div>

      <nav className={styles.toolTabs}>
        {[
          ["partie", "🎲 Sélection automatique"],
          ["enigmes", "🧩 Banque d’énigmes"],
          ["lettres", "🔤 Révéler une lettre"],
          ["cases", "↔ Cases spéciales"],
          ["television", "📺 Écran télévision"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id as ToolView)}
            className={view === id ? styles.toolTabActive : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === "partie" && (
        <div className={styles.toolPanel}>
          <h3>Sélectionner automatiquement les joueurs</h3>
          <p>
            Le site choisit au hasard des citoyens différents parmi les
            profils inscrits. La sélection manuelle existante reste disponible.
          </p>
          {state.game ? (
            <div className={styles.infoBox}>
              Une partie est déjà en cours. Ferme-la avant de lancer une
              nouvelle sélection automatique.
            </div>
          ) : (
            <form action={createFortuneGameAutoV87} className={styles.inlineForm}>
              <label>
                <span>Nombre de joueurs</span>
                <select name="player_count" defaultValue="3">
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? "joueur" : "joueurs"}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Tirer les joueurs et créer la partie</button>
            </form>
          )}
        </div>
      )}

      {view === "enigmes" && (
        <div className={styles.toolPanel}>
          <h3>Banque d’énigmes avec tirage aléatoire</h3>
          <form action={addFortunePuzzleV87} className={styles.formGrid}>
            <label>
              <span>Catégorie</span>
              <input name="category" maxLength={160} required placeholder="Cinéma" />
            </label>
            <label>
              <span>Difficulté</span>
              <select name="difficulty" defaultValue="normal">
                <option value="facile">Facile</option>
                <option value="normal">Normale</option>
                <option value="difficile">Difficile</option>
                <option value="finale">Finale</option>
              </select>
            </label>
            <label className={styles.fullField}>
              <span>Solution secrète</span>
              <input name="solution" maxLength={300} required />
            </label>
            <button type="submit">Ajouter à la banque</button>
          </form>

          {state.game && (
            <div className={styles.randomActions}>
              <form action={useRandomFortunePuzzleV87}>
                <input type="hidden" name="game_id" value={state.game.id} />
                <input
                  type="hidden"
                  name="round_number"
                  value={state.game.current_round}
                />
                <input type="hidden" name="for_final" value="false" />
                <button type="submit">
                  Tirer une énigme pour la manche {state.game.current_round}
                </button>
              </form>
              <form action={useRandomFortunePuzzleV87}>
                <input type="hidden" name="game_id" value={state.game.id} />
                <input type="hidden" name="round_number" value="0" />
                <input type="hidden" name="for_final" value="true" />
                <input type="hidden" name="difficulty" value="finale" />
                <button type="submit">Tirer une énigme finale</button>
              </form>
            </div>
          )}

          <div className={styles.puzzleList}>
            {puzzles.slice(0, 40).map((puzzle) => (
              <article key={puzzle.id}>
                <div>
                  <span>{puzzle.category} · {puzzle.difficulty}</span>
                  <strong>{puzzle.solution}</strong>
                  <small>Utilisée {puzzle.used_count} fois</small>
                </div>
                <form action={toggleFortunePuzzleV87}>
                  <input type="hidden" name="puzzle_id" value={puzzle.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={puzzle.active ? "false" : "true"}
                  />
                  <button type="submit">
                    {puzzle.active ? "Désactiver" : "Réactiver"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </div>
      )}

      {view === "lettres" && (
        <div className={styles.toolPanel}>
          <h3>Révélation manuelle par le présentateur</h3>
          {state.game ? (
            <form action={revealFortuneLetterV87} className={styles.inlineForm}>
              <input type="hidden" name="game_id" value={state.game.id} />
              <label>
                <span>Lettre à révéler partout</span>
                <input
                  name="letter"
                  maxLength={1}
                  required
                  placeholder="R"
                  className={styles.letterInput}
                />
              </label>
              <button type="submit">Révéler la lettre</button>
            </form>
          ) : (
            <p className={styles.emptyText}>Aucune partie en cours.</p>
          )}
        </div>
      )}

      {view === "cases" && (
        <div className={styles.toolPanel}>
          <h3>Configurer les cases Diviser et Échange</h3>
          <p>
            « Diviser » réduit de moitié la cagnotte de manche de la personne
            choisie. « Échange » permute les deux cagnottes de manche. Les
            cagnottes sécurisées ne sont jamais touchées.
          </p>

          <label className={styles.segmentPicker}>
            <span>Case de la roue normale</span>
            <select
              value={selectedSegmentId}
              onChange={(event) => setSelectedSegmentId(Number(event.target.value))}
            >
              {segments
                .filter((segment) => segment.wheel_type === "normal")
                .map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    Case {segment.position} — {segment.label}
                  </option>
                ))}
            </select>
          </label>

          {selectedSegment && (
            <form
              action={updateFortuneSpecialSegmentV87}
              className={styles.formGrid}
              key={selectedSegment.id}
            >
              <input type="hidden" name="segment_id" value={selectedSegment.id} />
              <label>
                <span>Texte affiché</span>
                <input
                  name="label"
                  maxLength={40}
                  defaultValue={selectedSegment.label}
                  required
                />
              </label>
              <label>
                <span>Type</span>
                <select name="segment_type" defaultValue={selectedSegment.segment_type}>
                  <option value="cash">Montant</option>
                  <option value="bankrupt">Banqueroute</option>
                  <option value="lose_turn">Passe ton tour</option>
                  <option value="jackpot">Jackpot</option>
                  <option value="free_turn">Tour gratuit</option>
                  <option value="prize">Prix final</option>
                  <option value="divide_bank">Diviser une cagnotte</option>
                  <option value="swap_bank">Échanger les cagnottes</option>
                </select>
              </label>
              <label>
                <span>Valeur en euros</span>
                <input
                  name="value"
                  type="number"
                  min={0}
                  step={100}
                  defaultValue={selectedSegment.value}
                />
              </label>
              <label>
                <span>Couleur</span>
                <input name="color" type="color" defaultValue={selectedSegment.color} />
              </label>
              <label>
                <span>État</span>
                <select name="active" defaultValue={selectedSegment.active ? "true" : "false"}>
                  <option value="true">Visible</option>
                  <option value="false">Masquée</option>
                </select>
              </label>
              <button type="submit">Modifier la case en direct</button>
            </form>
          )}
        </div>
      )}

      {view === "television" && (
        <div className={styles.toolPanel}>
          <h3>Écran télévision sans commandes</h3>
          <p>
            Cette page affiche uniquement la roue, l’énigme, les cagnottes, le
            chronomètre et le buzzer. Elle est prévue pour un second écran ou
            une capture OBS.
          </p>
          <Link
            href="/evenements/roue-de-la-fortune/ecran"
            target="_blank"
            className={styles.tvLink}
          >
            Ouvrir l’écran télévision dans un nouvel onglet
          </Link>
        </div>
      )}
    </section>
  );
}
