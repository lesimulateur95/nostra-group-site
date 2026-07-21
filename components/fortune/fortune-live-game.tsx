"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { FortuneManagerPanel } from "@/components/fortune/fortune-manager-panel";
import { FortunePlayerControls } from "@/components/fortune/fortune-player-controls";
import { FortunePuzzleBoard } from "@/components/fortune/fortune-puzzle-board";
import { FortuneWheel } from "@/components/fortune/fortune-wheel";
import type {
  FortuneCitizen,
  FortuneManagerRound,
  FortunePublicState,
} from "@/lib/fortune/data";
import styles from "@/components/fortune/fortune.module.css";

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function phaseLabel(phase: string): string {
  if (phase === "must_spin") return "Le joueur doit tourner la roue";
  if (phase === "choose_consonant") {
    return "Le joueur doit choisir une consonne";
  }
  if (phase === "can_act") {
    return "Tourner, acheter une voyelle ou proposer";
  }
  if (phase === "final_spin") {
    return "Le finaliste doit tourner la roue finale";
  }
  if (phase === "final_answer") {
    return "Le finaliste peut proposer la solution";
  }
  return "En attente de la Direction";
}

export function FortuneLiveGame({
  state,
  isManager,
  citizens,
  managerRounds,
  successMessage,
  errorMessage,
}: {
  state: FortunePublicState;
  isManager: boolean;
  citizens: FortuneCitizen[];
  managerRounds: FortuneManagerRound[];
  successMessage: string | null;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [localResult, setLocalResult] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!spinning) router.refresh();
    }, 2500);

    return () => window.clearInterval(interval);
  }, [router, spinning]);

  const currentPlayer = useMemo(
    () =>
      state.players.find(
        (player) => player.position === state.currentUserPosition,
      ) ?? null,
    [state.currentUserPosition, state.players],
  );

  const visibleSegments =
    state.settings.visible_wheel === "final"
      ? state.finalWheel.filter((segment) => segment.active)
      : state.settings.visible_wheel === "normal"
        ? state.normalWheel.filter((segment) => segment.active)
        : [];

  function handleSpinResult(
    segmentPosition: number,
    label: string,
  ) {
    const foundIndex = visibleSegments.findIndex(
      (segment) => segment.position === segmentPosition,
    );
    const index = Math.max(0, foundIndex);
    const count = Math.max(1, visibleSegments.length);
    const step = 360 / count;
    const centerAngle = index * step + step / 2;
    const target = 360 - centerAngle;

    setSpinning(true);
    setLocalResult(null);
    setRotation(
      (current) =>
        current - (current % 360) + 5 * 360 + target,
    );

    window.setTimeout(() => {
      setSpinning(false);
      setLocalResult(label);
    }, 3600);
  }

  if (!state.configured) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>ÉVÉNEMENTS & JEUX</span>
          <h1>La Roue de la Fortune</h1>
          <p>Le module doit être activé avec le SQL V45.</p>
        </section>
      </main>
    );
  }

  if (!state.settings.enabled && !isManager) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>ÉVÉNEMENTS & JEUX</span>
          <h1>La Roue de la Fortune</h1>
          <p>Le jeu est actuellement désactivé par la Direction.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>ÉVÉNEMENTS & JEUX</span>
        <h1>La Roue de la Fortune</h1>
        <p>
          Trois joueurs s’affrontent pendant quatre manches. Chacun
          possède sa propre cagnotte de manche et sa propre cagnotte
          sécurisée.
        </p>

        <div className={styles.jackpotBanner}>
          <span>JACKPOT PERSISTANT</span>
          <strong>{money(state.settings.jackpot_amount)}</strong>
          <small>
            +{money(state.settings.jackpot_increment)} par occurrence
            d’une bonne lettre. Il reste en place entre les parties tant
            qu’il n’est pas remporté.
          </small>
        </div>
      </section>

      {successMessage && (
        <div className={styles.success}>{successMessage}</div>
      )}
      {errorMessage && (
        <div className={styles.error}>{errorMessage}</div>
      )}

      {!state.game && (
        <section className={styles.waitingRoom}>
          <span>EN ATTENTE D’UNE PARTIE</span>
          <h2>La Direction doit sélectionner trois joueurs</h2>
          <p>La page se mettra automatiquement à jour.</p>
        </section>
      )}

      {state.game && (
        <>
          <section className={styles.gameStatus}>
            <div>
              <span>PARTIE</span>
              <strong>
                {state.game.status === "finale"
                  ? "MANCHE FINALE"
                  : `MANCHE ${state.game.current_round} / 4`}
              </strong>
            </div>
            <div>
              <span>ÉTAT DU TOUR</span>
              <strong>{phaseLabel(state.game.turn_phase)}</strong>
            </div>
            <div>
              <span>DERNIÈRE CASE</span>
              <strong>
                {localResult ??
                  state.game.last_spin_label ??
                  "Aucun lancer"}
              </strong>
            </div>
          </section>

          <section className={styles.scoreboard}>
            {state.players.map((player) => (
              <article
                className={`${styles.playerCard} ${
                  player.is_active ? styles.playerActive : ""
                }`}
                key={player.position}
              >
                <div className={styles.playerPosition}>
                  {player.position}
                </div>
                <div className={styles.playerIdentity}>
                  <strong>{player.player_name}</strong>
                  <span>
                    {player.is_active ? "JOUE MAINTENANT" : "EN ATTENTE"}
                  </span>
                </div>
                <div className={styles.playerMoney}>
                  <span>Cagnotte de la manche</span>
                  <strong>{money(player.round_bank)}</strong>
                </div>
                <div className={styles.playerMoney}>
                  <span>Cagnotte sécurisée</span>
                  <strong>{money(player.secured_bank)}</strong>
                </div>
              </article>
            ))}
          </section>

          {state.game.current_round === 4 &&
            state.game.status === "active" && (
              <div className={styles.finalRoundWarning}>
                QUATRIÈME MANCHE : chaque joueur met uniquement sa propre
                cagnotte totale en jeu. Le gagnant remporte sa cagnotte
                sécurisée additionnée à sa cagnotte de manche, jamais
                celles des deux autres joueurs.
              </div>
            )}

          {state.game.status !== "finale" && state.round && (
            <FortunePuzzleBoard
              category={state.round.category}
              puzzle={state.round.masked_puzzle}
              label={`MANCHE ${state.round.round_number}`}
            />
          )}

          {state.game.status === "finale" && (
            <FortunePuzzleBoard
              category={state.game.final_category ?? "Finale à préparer"}
              puzzle={state.game.final_masked_puzzle ?? ""}
              label="MANCHE FINALE"
            />
          )}

          <section className={styles.wheelPublicSection}>
            {state.settings.visible_wheel === "none" ? (
              <div className={styles.hiddenWheel}>
                La Direction a temporairement caché les deux roues.
              </div>
            ) : (
              <>
                <FortuneWheel
                  segments={visibleSegments}
                  rotation={rotation}
                  spinning={spinning}
                />
                <div className={styles.visibleWheelLabel}>
                  {state.settings.visible_wheel === "normal"
                    ? "ROUE NORMALE"
                    : "ROUE DE LA MANCHE FINALE"}
                </div>
              </>
            )}
          </section>

          <FortunePlayerControls
            game={state.game}
            currentPlayer={currentPlayer}
            settings={state.settings}
            visibleSegments={visibleSegments}
            onSpinResult={handleSpinResult}
          />

          <section className={styles.rules}>
            <h2>Règles des cagnottes</h2>
            <div className={styles.ruleGrid}>
              <article>
                <strong>Manches 1 à 3</strong>
                <p>
                  Le joueur qui trouve l’énigme transfère sa cagnotte de
                  manche dans sa propre cagnotte sécurisée. Les sommes
                  non sécurisées de la manche sont remises à zéro.
                </p>
              </article>
              <article>
                <strong>Quatrième manche</strong>
                <p>
                  Chaque joueur joue uniquement son propre total. Le
                  gagnant conserve sa cagnotte sécurisée plus sa cagnotte
                  de manche. Il ne récupère jamais l’argent des autres.
                </p>
              </article>
              <article>
                <strong>Jackpot permanent</strong>
                <p>
                  Chaque bonne occurrence ajoute 100 €. Le jackpot
                  continue de monter pendant toutes les parties jusqu’à
                  ce qu’il soit remporté.
                </p>
              </article>
            </div>
          </section>
        </>
      )}

      {isManager && (
        <FortuneManagerPanel
          state={state}
          citizens={citizens}
          managerRounds={managerRounds}
        />
      )}
    </main>
  );
}
