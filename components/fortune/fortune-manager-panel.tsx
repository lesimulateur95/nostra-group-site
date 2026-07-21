"use client";

import { useMemo, useState } from "react";

import {
  advanceFortuneRound,
  cancelFortuneGame,
  createFortuneGame,
  saveFortuneFinalPuzzle,
  saveFortuneRound,
  setFortuneActivePlayer,
  setFortuneWheelVisibility,
  startFortuneRound,
  toggleFortuneGame,
  updateFortuneWheelSegment,
} from "@/app/actions/fortune";
import { FortuneWheel } from "@/components/fortune/fortune-wheel";
import type {
  FortuneCitizen,
  FortuneManagerRound,
  FortuneSegment,
  FortuneState,
} from "@/lib/fortune/data";
import styles from "./fortune.module.css";

type ManagerView =
  | "partie"
  | "enigme"
  | "joueurs"
  | "roue-normale"
  | "roue-finale"
  | "finale";

const managerViews: Array<{
  id: ManagerView;
  icon: string;
  label: string;
}> = [
  { id: "partie", icon: "🎛️", label: "Partie" },
  { id: "enigme", icon: "▦", label: "Énigme" },
  { id: "joueurs", icon: "👥", label: "Joueurs" },
  { id: "roue-normale", icon: "🎡", label: "Roue normale" },
  { id: "roue-finale", icon: "🏆", label: "Roue finale" },
  { id: "finale", icon: "★", label: "Finale" },
];

export function FortuneManagerPanel({
  state,
  citizens,
  managerRounds,
}: {
  state: FortuneState;
  citizens: FortuneCitizen[];
  managerRounds: FortuneManagerRound[];
}) {
  const [playerCount, setPlayerCount] = useState(3);
  const [view, setView] = useState<ManagerView>("partie");

  const allSegments = useMemo(
    () => [...state.normalWheel, ...state.finalWheel],
    [state.normalWheel, state.finalWheel],
  );

  const [selectedId, setSelectedId] = useState<number | null>(
    allSegments[0]?.id ?? null,
  );

  const selected =
    allSegments.find((segment) => segment.id === selectedId) ??
    allSegments[0] ??
    null;

  const currentRound = managerRounds.find(
    (round) =>
      round.round_number === (state.game?.current_round ?? 1),
  );

  function openView(nextView: ManagerView) {
    setView(nextView);

    if (nextView === "roue-normale") {
      setSelectedId(state.normalWheel[0]?.id ?? null);
    }

    if (nextView === "roue-finale") {
      setSelectedId(state.finalWheel[0]?.id ?? null);
    }
  }

  return (
    <aside className={styles.managerPanel}>
      <header className={styles.managerHeader}>
        <div>
          <span>ACCÈS GÉRANT UNIQUEMENT</span>
          <h2>Régie de la Roue de la Fortune</h2>
          <p>
            Toutes les commandes sont regroupées dans des cases. Ouvre
            seulement la partie que tu souhaites gérer.
          </p>
        </div>

        <form action={toggleFortuneGame}>
          <input
            type="hidden"
            name="enabled"
            value={state.settings.enabled ? "false" : "true"}
          />
          <button
            className={
              state.settings.enabled
                ? styles.managerDanger
                : styles.managerSuccess
            }
            type="submit"
          >
            {state.settings.enabled
              ? "Désactiver le jeu"
              : "Réactiver le jeu"}
          </button>
        </form>
      </header>

      {!state.game && (
        <section className={styles.managerSection}>
          <span className={styles.managerEyebrow}>
            NOUVELLE PARTIE
          </span>
          <h3>Choisir entre 1 et 6 joueurs</h3>

          <div className={styles.playerCountPicker}>
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <button
                key={count}
                type="button"
                className={
                  playerCount === count
                    ? styles.playerCountActive
                    : undefined
                }
                onClick={() => setPlayerCount(count)}
              >
                <strong>{count}</strong>
                <span>{count === 1 ? "joueur" : "joueurs"}</span>
              </button>
            ))}
          </div>

          <form
            action={createFortuneGame}
            className={styles.managerGrid}
          >
            <input
              type="hidden"
              name="player_count"
              value={playerCount}
            />

            {Array.from(
              { length: playerCount },
              (_, index) => index + 1,
            ).map((position) => (
              <label key={position}>
                <span>Joueur {position}</span>
                <select
                  name={`player_${position}`}
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Choisir un citoyen
                  </option>
                  {citizens.map((citizen) => (
                    <option
                      key={`${position}-${citizen.user_id}`}
                      value={citizen.user_id}
                    >
                      {citizen.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <button type="submit">
              Créer la partie avec {playerCount}{" "}
              {playerCount === 1 ? "joueur" : "joueurs"}
            </button>
          </form>
        </section>
      )}

      {state.game && (
        <>
          <nav
            className={styles.managerTabs}
            aria-label="Commandes de la Roue de la Fortune"
          >
            {managerViews.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  view === item.id
                    ? styles.managerTabActive
                    : styles.managerTab
                }
                onClick={() => openView(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </nav>

          <div className={styles.managerCompactPanel}>
            {view === "partie" && (
              <section className={styles.managerSection}>
                <span className={styles.managerEyebrow}>
                  PARTIE EN COURS
                </span>

                <div className={styles.managerSummaryGrid}>
                  <div>
                    <span>JOUEURS</span>
                    <strong>{state.players.length}</strong>
                  </div>
                  <div>
                    <span>MANCHE</span>
                    <strong>{state.game.current_round} / 4</strong>
                  </div>
                  <div>
                    <span>JOUEUR ACTIF</span>
                    <strong>
                      {state.players.find(
                        (player) => player.is_active,
                      )?.player_name ?? "En attente"}
                    </strong>
                  </div>
                  <div>
                    <span>SYNCHRONISATION</span>
                    <strong>Direct activé</strong>
                  </div>
                </div>

                <h3>Roue visible pour les citoyens</h3>
                <div className={styles.visibilityButtons}>
                  {[
                    ["normal", "Afficher la roue normale"],
                    ["final", "Afficher la roue finale"],
                    ["none", "Cacher les deux roues"],
                  ].map(([value, label]) => (
                    <form
                      action={setFortuneWheelVisibility}
                      key={value}
                    >
                      <button
                        name="visible_wheel"
                        value={value}
                        type="submit"
                        className={
                          state.settings.visible_wheel === value
                            ? styles.managerSelected
                            : undefined
                        }
                      >
                        {label}
                      </button>
                    </form>
                  ))}
                </div>

                <div className={styles.managerActionRow}>
                  <form action={cancelFortuneGame}>
                    <input
                      type="hidden"
                      name="game_id"
                      value={state.game.id}
                    />
                    <button
                      className={styles.managerDanger}
                      type="submit"
                    >
                      Annuler et fermer la partie
                    </button>
                  </form>
                </div>
              </section>
            )}

            {view === "enigme" && (
              <section className={styles.managerSection}>
                <span className={styles.managerEyebrow}>
                  MANCHE {state.game.current_round}
                </span>
                <h3>Énigme de la manche actuelle</h3>

                <form
                  action={saveFortuneRound}
                  className={styles.managerGrid}
                >
                  <input
                    type="hidden"
                    name="game_id"
                    value={state.game.id}
                  />
                  <input
                    type="hidden"
                    name="round_number"
                    value={state.game.current_round}
                  />

                  <label>
                    <span>Catégorie</span>
                    <input
                      name="category"
                      type="text"
                      maxLength={160}
                      defaultValue={currentRound?.category ?? ""}
                      required
                    />
                  </label>

                  <label className={styles.managerFull}>
                    <span>Solution secrète</span>
                    <input
                      name="solution"
                      type="text"
                      maxLength={300}
                      defaultValue={currentRound?.solution ?? ""}
                      required
                    />
                  </label>

                  <button type="submit">
                    Enregistrer l’énigme
                  </button>
                </form>

                <div className={styles.managerActionRow}>
                  {(state.game.status === "setup" ||
                    state.game.status === "between_rounds") && (
                    <form action={startFortuneRound}>
                      <input
                        type="hidden"
                        name="game_id"
                        value={state.game.id}
                      />
                      <button
                        className={styles.managerSuccess}
                        type="submit"
                      >
                        Démarrer la manche
                      </button>
                    </form>
                  )}

                  {state.game.status === "between_rounds" &&
                    state.round?.status === "won" &&
                    state.game.current_round < 4 && (
                      <form action={advanceFortuneRound}>
                        <input
                          type="hidden"
                          name="game_id"
                          value={state.game.id}
                        />
                        <button type="submit">
                          Préparer la manche suivante
                        </button>
                      </form>
                    )}
                </div>
              </section>
            )}

            {view === "joueurs" && (
              <section className={styles.managerSection}>
                <span className={styles.managerEyebrow}>
                  JOUEURS
                </span>
                <h3>Joueur actif et cagnottes</h3>

                <form
                  action={setFortuneActivePlayer}
                  className={styles.managerInline}
                >
                  <input
                    type="hidden"
                    name="game_id"
                    value={state.game.id}
                  />
                  <select
                    name="player_position"
                    defaultValue={
                      state.game.active_player_position ?? 1
                    }
                  >
                    {state.players.map((player) => (
                      <option
                        key={player.position}
                        value={player.position}
                      >
                        {player.position}. {player.player_name}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Changer le joueur</button>
                </form>

                <div className={styles.managerPlayerList}>
                  {state.players.map((player) => (
                    <article
                      key={player.position}
                      className={
                        player.is_active
                          ? styles.managerPlayerActive
                          : undefined
                      }
                    >
                      <strong>
                        {player.position}. {player.player_name}
                      </strong>
                      <span>
                        Manche : {player.round_bank.toLocaleString("fr-FR")} €
                      </span>
                      <span>
                        Sécurisée : {player.secured_bank.toLocaleString("fr-FR")} €
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {view === "roue-normale" && (
              <WheelEditor
                title="ROUE NORMALE"
                segments={state.normalWheel}
                selectedId={selectedId}
                onSelect={setSelectedId}
                selected={selected}
              />
            )}

            {view === "roue-finale" && (
              <WheelEditor
                title="ROUE FINALE"
                segments={state.finalWheel}
                selectedId={selectedId}
                onSelect={setSelectedId}
                selected={selected}
              />
            )}

            {view === "finale" && (
              <section className={styles.managerSection}>
                <span className={styles.managerEyebrow}>
                  MANCHE FINALE
                </span>
                <h3>Préparer l’énigme finale</h3>

                <form
                  action={saveFortuneFinalPuzzle}
                  className={styles.managerGrid}
                >
                  <input
                    type="hidden"
                    name="game_id"
                    value={state.game.id}
                  />

                  <label>
                    <span>Catégorie finale</span>
                    <input
                      name="final_category"
                      type="text"
                      maxLength={160}
                      required
                    />
                  </label>

                  <label className={styles.managerFull}>
                    <span>Solution finale secrète</span>
                    <input
                      name="final_solution"
                      type="text"
                      maxLength={300}
                      required
                    />
                  </label>

                  <label>
                    <span>Lettres offertes</span>
                    <input
                      name="final_revealed_letters"
                      type="text"
                      maxLength={30}
                      defaultValue="RSTLNE"
                    />
                  </label>

                  <button type="submit">
                    Enregistrer la finale
                  </button>
                </form>
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function WheelEditor({
  title,
  segments,
  selectedId,
  onSelect,
  selected,
}: {
  title: string;
  segments: FortuneSegment[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  selected: FortuneSegment | null;
}) {
  const wheelSelected =
    selected?.wheel_type === segments[0]?.wheel_type
      ? selected
      : segments[0] ?? null;

  return (
    <section className={styles.managerSection}>
      <span className={styles.managerEyebrow}>{title}</span>
      <h3>Appuie sur une case pour modifier son contenu</h3>

      <div className={styles.managerWheelLayout}>
        <div className={styles.managerCompactWheel}>
          <FortuneWheel
            segments={segments}
            rotation={0}
            transitionMs={0}
            compact
            selectedSegmentId={selectedId}
            onSegmentClick={(segment) => onSelect(segment.id)}
          />
        </div>

        {wheelSelected && (
          <SegmentForm segment={wheelSelected} />
        )}
      </div>
    </section>
  );
}

function SegmentForm({
  segment,
}: {
  segment: FortuneSegment;
}) {
  return (
    <div className={styles.managerSegmentCard}>
      <span className={styles.managerEyebrow}>
        CASE {segment.position}
      </span>
      <h3>
        {segment.wheel_type === "normal"
          ? "Roue normale"
          : "Roue finale"}
      </h3>

      <form
        action={updateFortuneWheelSegment}
        className={styles.managerGrid}
        key={segment.id}
      >
        <input
          type="hidden"
          name="segment_id"
          value={segment.id}
        />

        <label>
          <span>Texte affiché</span>
          <input
            name="label"
            defaultValue={segment.label}
            maxLength={40}
            required
          />
        </label>

        <label>
          <span>Type de case</span>
          <select
            name="segment_type"
            defaultValue={segment.segment_type}
          >
            <option value="cash">Montant</option>
            <option value="bankrupt">Banqueroute</option>
            <option value="lose_turn">Passe ton tour</option>
            <option value="jackpot">Jackpot</option>
            <option value="free_turn">Tour gratuit</option>
            <option value="prize">Prix final</option>
          </select>
        </label>

        <label>
          <span>Valeur en euros</span>
          <input
            name="value"
            type="number"
            min={0}
            step={100}
            defaultValue={segment.value}
          />
        </label>

        <label>
          <span>Couleur</span>
          <input
            name="color"
            type="color"
            defaultValue={segment.color}
          />
        </label>

        <label>
          <span>Case active</span>
          <select
            name="active"
            defaultValue={segment.active ? "true" : "false"}
          >
            <option value="true">Visible</option>
            <option value="false">Masquée</option>
          </select>
        </label>

        <button type="submit">
          Modifier la case en direct
        </button>
      </form>
    </div>
  );
}
