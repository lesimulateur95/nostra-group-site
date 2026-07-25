"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FortunePuzzleBoard } from "@/components/fortune/fortune-puzzle-board";
import { FortuneWheel } from "@/components/fortune/fortune-wheel";
import type { FortuneState } from "@/lib/fortune/data";
import type { FortuneExtraStateV87 } from "@/lib/fortune/v87-data";
import styles from "./fortune-v87.module.css";

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function seconds(deadline: string | null): number | null {
  if (!deadline) return null;
  const parsed = Date.parse(deadline);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.ceil((parsed - Date.now()) / 1000));
}

export function FortuneTvDisplay({
  initialState,
  initialExtra,
}: {
  initialState: FortuneState;
  initialExtra: FortuneExtraStateV87;
}) {
  const [state, setState] = useState(initialState);
  const [extra, setExtra] = useState(initialExtra);
  const [remaining, setRemaining] = useState<number | null>(() =>
    seconds(initialExtra.turn_deadline),
  );
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [transitionMs, setTransitionMs] = useState(3_600);
  const lastSequence = useRef(initialState.game?.spin_sequence ?? 0);
  const spinTimer = useRef<number | null>(null);

  const visibleSegments = useMemo(
    () =>
      state.settings.visible_wheel === "final"
        ? state.finalWheel.filter((segment) => segment.active)
        : state.settings.visible_wheel === "normal"
          ? state.normalWheel.filter((segment) => segment.active)
          : [],
    [state],
  );

  const animate = useCallback(
    (position: number, duration: number) => {
      const index = visibleSegments.findIndex(
        (segment) => segment.position === position,
      );
      if (index < 0 || visibleSegments.length === 0) return;

      const step = 360 / visibleSegments.length;
      const target = 360 - (index * step + step / 2);
      setTransitionMs(Math.max(250, duration));
      setSpinning(true);
      setRotation(
        (current) => current - (current % 360) + 5 * 360 + target,
      );

      if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
      spinTimer.current = window.setTimeout(() => {
        setSpinning(false);
        spinTimer.current = null;
      }, Math.max(250, duration) + 100);
    },
    [visibleSegments],
  );

  useEffect(() => {
    let active = true;
    let running = false;

    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch("/api/fortune/tv-state", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          state: FortuneState;
          extra: FortuneExtraStateV87;
        };
        if (!active) return;
        setState(payload.state);
        setExtra(payload.extra);
      } finally {
        running = false;
      }
    };

    const interval = window.setInterval(refresh, 1_250);
    return () => {
      active = false;
      window.clearInterval(interval);
      if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(
      () => setRemaining(seconds(extra.turn_deadline)),
      200,
    );
    setRemaining(seconds(extra.turn_deadline));
    return () => window.clearInterval(interval);
  }, [extra.turn_deadline]);

  useEffect(() => {
    const game = state.game;
    if (!game || game.last_spin_position == null) return;
    if (game.spin_sequence <= lastSequence.current) return;
    lastSequence.current = game.spin_sequence;
    animate(game.last_spin_position, game.spin_duration_ms);
  }, [animate, state.game]);

  const game = state.game;
  if (!game) {
    return (
      <main className={styles.tvScreen}>
        <div className={styles.tvWaiting}>
          <span>NOSTRA GROUP PRÉSENTE</span>
          <h1>La Roue de la Fortune</h1>
          <p>En attente du lancement d’une partie…</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.tvScreen}>
      <header className={styles.tvHeader}>
        <div>
          <span>NOSTRA GROUP · DIRECT</span>
          <h1>La Roue de la Fortune</h1>
        </div>
        <div className={styles.tvTimer}>
          <span>CHRONO</span>
          <strong>{remaining == null ? "--" : remaining}</strong>
        </div>
      </header>

      <section className={styles.tvScores}>
        {state.players.map((player) => (
          <article
            key={player.position}
            className={player.is_active ? styles.tvPlayerActive : undefined}
          >
            <span>{player.position}</span>
            <strong>{player.player_name}</strong>
            <small>Manche {money(player.round_bank)}</small>
            <small>Sécurisée {money(player.secured_bank)}</small>
          </article>
        ))}
      </section>

      <section className={styles.tvMain}>
        <div className={styles.tvPuzzle}>
          {game.status === "finale" ? (
            <FortunePuzzleBoard
              category={game.final_category ?? "Finale"}
              puzzle={game.final_masked_puzzle ?? ""}
              label="MANCHE FINALE"
            />
          ) : state.round ? (
            <FortunePuzzleBoard
              category={state.round.category}
              puzzle={state.round.masked_puzzle}
              label={`MANCHE ${state.round.round_number}`}
            />
          ) : (
            <div className={styles.tvWaitingPuzzle}>Énigme en préparation</div>
          )}
        </div>

        <div className={styles.tvWheelArea}>
          {visibleSegments.length ? (
            <FortuneWheel
              segments={visibleSegments}
              rotation={rotation}
              spinning={spinning}
              transitionMs={transitionMs}
            />
          ) : (
            <div className={styles.tvWaitingPuzzle}>Roue temporairement cachée</div>
          )}
          <div className={styles.tvLastResult}>
            <span>DERNIÈRE CASE</span>
            <strong>{game.last_spin_label ?? "Aucun lancer"}</strong>
          </div>
        </div>
      </section>

      {(extra.buzzer_player_name || extra.pending_special_action) && (
        <div className={styles.tvAlert}>
          {extra.buzzer_player_name
            ? `🔔 ${extra.buzzer_player_name} A BUZZÉ !`
            : extra.pending_special_action === "divide_bank"
              ? `${extra.pending_actor_name ?? "Le joueur"} choisit une cagnotte à diviser`
              : `${extra.pending_actor_name ?? "Le joueur"} choisit une cagnotte à échanger`}
        </div>
      )}
    </main>
  );
}
