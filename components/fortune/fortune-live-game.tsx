"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { FortuneManagerPanel } from "@/components/fortune/fortune-manager-panel";
import {
  FortunePlayerControls,
  type FortuneSpinResult,
} from "@/components/fortune/fortune-player-controls";
import { FortunePuzzleBoard } from "@/components/fortune/fortune-puzzle-board";
import { FortuneWheel } from "@/components/fortune/fortune-wheel";
import type {
  FortuneCitizen,
  FortuneManagerRound,
  FortuneState,
} from "@/lib/fortune/data";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import styles from "@/components/fortune/fortune.module.css";

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function phaseLabel(phase: string): string {
  if (phase === "must_spin") {
    return "Le joueur doit tourner la roue";
  }
  if (phase === "choose_consonant") {
    return "Le joueur doit choisir une consonne";
  }
  if (phase === "can_act") {
    return "Le joueur garde la main";
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
  state: FortuneState;
  isManager: boolean;
  citizens: FortuneCitizen[];
  managerRounds: FortuneManagerRound[];
  successMessage: string | null;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [transitionMs, setTransitionMs] = useState(3600);
  const [localResult, setLocalResult] = useState<string | null>(
    null,
  );

  const lastSpinSequenceRef = useRef(
    state.game?.spin_sequence ?? 0,
  );
  const initialSpinCheckedRef = useRef(false);
  const spinTimerRef = useRef<number | null>(null);

  const currentPlayer = useMemo(
    () =>
      state.players.find(
        (player) =>
          player.position === state.currentUserPosition,
      ) ?? null,
    [state.currentUserPosition, state.players],
  );

  const visibleSegments = useMemo(
    () =>
      state.settings.visible_wheel === "final"
        ? state.finalWheel.filter((segment) => segment.active)
        : state.settings.visible_wheel === "normal"
          ? state.normalWheel.filter((segment) => segment.active)
          : [],
    [
      state.finalWheel,
      state.normalWheel,
      state.settings.visible_wheel,
    ],
  );

  const animateToSegment = useCallback(
    (
      segmentPosition: number,
      label: string,
      duration: number,
    ) => {
      const foundIndex = visibleSegments.findIndex(
        (segment) => segment.position === segmentPosition,
      );

      if (foundIndex < 0 || visibleSegments.length === 0) {
        return;
      }

      const step = 360 / visibleSegments.length;
      const centerAngle = foundIndex * step + step / 2;
      const target = 360 - centerAngle;
      const safeDuration = Math.max(250, duration);

      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
      }

      setTransitionMs(safeDuration);
      setSpinning(true);
      setLocalResult(null);
      setRotation(
        (current) =>
          current - (current % 360) + 5 * 360 + target,
      );

      spinTimerRef.current = window.setTimeout(() => {
        setSpinning(false);
        setLocalResult(label);
        spinTimerRef.current = null;
      }, safeDuration + 80);
    },
    [visibleSegments],
  );

  // Toutes les personnes présentes reçoivent les mêmes changements
  // de partie, joueurs, énigmes et roues via Supabase Realtime.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        router.refresh();
        refreshTimer = null;
      }, 90);
    };

    const channel = supabase
      .channel(
        `fortune-live-${state.game?.id ?? "lobby"}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fortune_settings",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fortune_games",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fortune_game_players",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fortune_rounds",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fortune_wheel_segments",
        },
        scheduleRefresh,
      )
      .subscribe();

    const fallback = window.setInterval(scheduleRefresh, 5000);

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [router, state.game?.id]);

  // Lorsqu’une personne tourne la roue, le résultat décidé côté serveur
  // est rejoué chez tous les participants et spectateurs.
  useEffect(() => {
    const game = state.game;

    if (!game || game.last_spin_position == null) return;

    const startedAt = game.spin_started_at
      ? Date.parse(game.spin_started_at)
      : Number.NaN;
    const elapsed = Number.isFinite(startedAt)
      ? Math.max(0, Date.now() - startedAt)
      : game.spin_duration_ms;
    const remaining = Math.max(
      250,
      game.spin_duration_ms - elapsed,
    );
    const ongoing = elapsed < game.spin_duration_ms + 200;

    if (!initialSpinCheckedRef.current) {
      initialSpinCheckedRef.current = true;
      lastSpinSequenceRef.current = game.spin_sequence;

      if (ongoing) {
        animateToSegment(
          game.last_spin_position,
          game.last_spin_label ?? "Résultat",
          remaining,
        );
      }
      return;
    }

    if (game.spin_sequence > lastSpinSequenceRef.current) {
      lastSpinSequenceRef.current = game.spin_sequence;
      animateToSegment(
        game.last_spin_position,
        game.last_spin_label ?? "Résultat",
        remaining,
      );
    }
  }, [
    animateToSegment,
    state.game?.last_spin_label,
    state.game?.last_spin_position,
    state.game?.spin_duration_ms,
    state.game?.spin_sequence,
    state.game?.spin_started_at,
  ]);

  useEffect(
    () => () => {
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
      }
    },
    [],
  );

  function handleSpinResult(result: FortuneSpinResult) {
    lastSpinSequenceRef.current = Math.max(
      lastSpinSequenceRef.current,
      result.sequence,
    );

    const parsedStartedAt = result.startedAt
      ? Date.parse(result.startedAt)
      : Number.NaN;
    const elapsed = Number.isFinite(parsedStartedAt)
      ? Math.max(0, Date.now() - parsedStartedAt)
      : 0;

    animateToSegment(
      result.segmentPosition,
      result.label,
      Math.max(250, result.durationMs - elapsed),
    );
  }

  if (!state.configured) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            ÉVÉNEMENTS & JEUX
          </span>
          <h1>La Roue de la Fortune</h1>
          <p>Le module doit être activé avec le SQL V47.</p>
        </section>
      </main>
    );
  }

  if (!state.settings.enabled && !isManager) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            ÉVÉNEMENTS & JEUX
          </span>
          <h1>La Roue de la Fortune</h1>
          <p>
            Le jeu est actuellement désactivé par la Direction.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>
          ÉVÉNEMENTS & JEUX · DIRECT SYNCHRONISÉ
        </span>
        <h1>La Roue de la Fortune</h1>
        <p>
          Une partie peut accueillir de 1 à 6 joueurs. Toutes les
          personnes présentes voient en direct la même énigme, la même
          roue, le même résultat et le même joueur actif.
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
          <h2>
            La Direction doit sélectionner entre 1 et 6 joueurs
          </h2>
          <p>
            La page se mettra automatiquement à jour dès que la partie
            sera créée.
          </p>
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
              <span>JOUEURS</span>
              <strong>{state.players.length} / 6</strong>
            </div>
            <div>
              <span>ÉTAT DU TOUR</span>
              <strong>
                {phaseLabel(state.game.turn_phase)}
              </strong>
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
                    {player.is_active
                      ? "JOUE MAINTENANT"
                      : "EN ATTENTE"}
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
                QUATRIÈME MANCHE : chaque joueur met uniquement sa
                propre cagnotte totale en jeu. Le gagnant conserve sa
                cagnotte sécurisée additionnée à sa cagnotte de manche,
                jamais celles des autres joueurs.
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
              category={
                state.game.final_category ?? "Finale à préparer"
              }
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
                  transitionMs={transitionMs}
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
            <h2>Règles du tour</h2>
            <div className={styles.ruleGrid}>
              <article>
                <strong>Le joueur garde la main</strong>
                <p>
                  Une bonne consonne ou une bonne voyelle ne termine pas
                  le tour. Le joueur peut tourner à nouveau, acheter une
                  voyelle ou proposer la solution.
                </p>
              </article>
              <article>
                <strong>Le tour passe uniquement</strong>
                <p>
                  Le joueur perd la main après une mauvaise consonne,
                  une mauvaise voyelle, une mauvaise proposition,
                  « Passe ton tour » ou « Banqueroute ».
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
