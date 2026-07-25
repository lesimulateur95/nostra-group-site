"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  pressFortuneBuzzerV87,
  resetFortuneBuzzerV87,
  resolveFortuneSpecialV87,
  startFortuneTimerV87,
  stopFortuneTimerV87,
} from "@/app/actions/fortune-v87";
import type { FortuneGame, FortunePlayer } from "@/lib/fortune/data";
import type { FortuneExtraStateV87 } from "@/lib/fortune/v87-data";
import styles from "./fortune-v87.module.css";

function remainingSeconds(deadline: string | null): number | null {
  if (!deadline) return null;
  const value = Date.parse(deadline);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.ceil((value - Date.now()) / 1000));
}

function playAudio(src: string, volume = 0.55) {
  const audio = new Audio(src);
  audio.volume = volume;
  void audio.play().catch(() => undefined);
}

export function FortuneV87LiveTools({
  game,
  players,
  currentUserPosition,
  isManager,
  initialExtra,
}: {
  game: FortuneGame | null;
  players: FortunePlayer[];
  currentUserPosition: number | null;
  isManager: boolean;
  initialExtra: FortuneExtraStateV87;
}) {
  const [extra, setExtra] = useState(initialExtra);
  const [remaining, setRemaining] = useState<number | null>(() =>
    remainingSeconds(initialExtra.turn_deadline),
  );
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const lastBuzzerAt = useRef<string | null>(initialExtra.buzzer_at);
  const lastSpinSequence = useRef<number>(game?.spin_sequence ?? 0);
  const lastCountdownBeep = useRef<number | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("fortune-v87-audio");
    if (saved === "on") setAudioEnabled(true);
    if (saved === "off") setAudioEnabled(false);
  }, []);

  useEffect(() => {
    const audio = new Audio("/audio/fortune/music-loop.wav");
    audio.loop = true;
    audio.volume = 0.14;
    musicRef.current = audio;

    return () => {
      audio.pause();
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;

    if (audioEnabled && musicEnabled && game) {
      void music.play().catch(() => undefined);
    } else {
      music.pause();
    }
  }, [audioEnabled, musicEnabled, game]);

  useEffect(() => {
    if (!game?.id) return;
    let active = true;
    let running = false;

    const refresh = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const response = await fetch(
          `/api/fortune/v87-state?gameId=${encodeURIComponent(game.id)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const next = (await response.json()) as FortuneExtraStateV87;
        if (!active) return;
        setExtra(next);
      } catch {
        // Le jeu principal reste utilisable en cas de coupure momentanée.
      } finally {
        running = false;
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 1_200);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [game?.id]);

  useEffect(() => {
    const tick = () => setRemaining(remainingSeconds(extra.turn_deadline));
    tick();
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [extra.turn_deadline]);

  useEffect(() => {
    if (!audioEnabled || remaining == null) return;
    if (
      remaining > 0 &&
      remaining <= 5 &&
      lastCountdownBeep.current !== remaining
    ) {
      lastCountdownBeep.current = remaining;
      playAudio("/audio/fortune/countdown.wav", 0.5);
    }
    if (remaining === 0 && lastCountdownBeep.current !== 0) {
      lastCountdownBeep.current = 0;
      playAudio("/audio/fortune/buzzer.wav", 0.65);
    }
  }, [audioEnabled, remaining]);

  useEffect(() => {
    if (!audioEnabled || !extra.buzzer_at) return;
    if (extra.buzzer_at !== lastBuzzerAt.current) {
      lastBuzzerAt.current = extra.buzzer_at;
      playAudio("/audio/fortune/buzzer.wav", 0.72);
    }
  }, [audioEnabled, extra.buzzer_at]);

  useEffect(() => {
    if (!audioEnabled || !game) return;
    if (game.spin_sequence <= lastSpinSequence.current) return;

    lastSpinSequence.current = game.spin_sequence;
    playAudio("/audio/fortune/wheel-spin.wav", 0.5);

    const spinType = String(game.last_spin_type ?? "");
    const timer = window.setTimeout(() => {
      if (spinType === "bankrupt") {
        playAudio("/audio/fortune/bankrupt.wav", 0.65);
      } else if (
        spinType === "divide_bank" ||
        spinType === "swap_bank"
      ) {
        playAudio("/audio/fortune/special.wav", 0.62);
      } else if (spinType === "jackpot") {
        playAudio("/audio/fortune/success.wav", 0.64);
      }
    }, Math.max(500, game.spin_duration_ms || 3_600));

    return () => window.clearTimeout(timer);
  }, [audioEnabled, game]);

  const actor = useMemo(
    () =>
      players.find(
        (player) => player.position === extra.pending_actor_position,
      ) ?? null,
    [extra.pending_actor_position, players],
  );

  const targetPlayers = useMemo(() => {
    if (extra.pending_special_action === "swap_bank") {
      return players.filter(
        (player) => player.position !== extra.pending_actor_position,
      );
    }
    return players;
  }, [extra.pending_actor_position, extra.pending_special_action, players]);

  if (!game) return null;

  const isPendingActor =
    currentUserPosition != null &&
    currentUserPosition === extra.pending_actor_position;
  const canBuzz =
    currentUserPosition != null &&
    extra.buzzer_active &&
    !extra.buzzer_user_id &&
    (remaining == null || remaining > 0);

  return (
    <section className={styles.liveTools}>
      <div className={styles.sectionHeading}>
        <div>
          <span>OUTILS DE DIRECT</span>
          <h2>Chronomètre, buzzer et ambiance sonore</h2>
        </div>
        <div className={styles.audioButtons}>
          <button
            type="button"
            onClick={() => {
              const next = !audioEnabled;
              setAudioEnabled(next);
              window.localStorage.setItem(
                "fortune-v87-audio",
                next ? "on" : "off",
              );
              if (next) playAudio("/audio/fortune/success.wav", 0.35);
            }}
          >
            {audioEnabled ? "🔊 Sons activés" : "🔇 Activer les sons"}
          </button>
          <button
            type="button"
            onClick={() => setMusicEnabled((current) => !current)}
            disabled={!audioEnabled}
          >
            {musicEnabled ? "♫ Musique active" : "♫ Musique coupée"}
          </button>
        </div>
      </div>

      <div className={styles.liveGrid}>
        <article className={styles.timerCard}>
          <span>CHRONOMÈTRE</span>
          <strong className={remaining != null && remaining <= 5 ? styles.timerDanger : undefined}>
            {remaining == null ? "--" : remaining}
          </strong>
          <small>
            {extra.turn_deadline
              ? remaining === 0
                ? "Temps écoulé"
                : "secondes restantes"
              : "Chronomètre arrêté"}
          </small>

          {isManager && (
            <div className={styles.timerActions}>
              {[20, 30, 45, 60].map((seconds) => (
                <form action={startFortuneTimerV87} key={seconds}>
                  <input type="hidden" name="game_id" value={game.id} />
                  <input type="hidden" name="seconds" value={seconds} />
                  <button type="submit">{seconds} s</button>
                </form>
              ))}
              <form action={stopFortuneTimerV87}>
                <input type="hidden" name="game_id" value={game.id} />
                <button type="submit" className={styles.dangerButton}>
                  Stop
                </button>
              </form>
            </div>
          )}
        </article>

        <article className={styles.buzzerCard}>
          <span>BUZZER MANUEL</span>
          <strong>
            {extra.buzzer_player_name
              ? `${extra.buzzer_player_name} a buzzé !`
              : extra.buzzer_active
                ? "Buzzer ouvert"
                : "Buzzer fermé"}
          </strong>
          <small>Le premier joueur qui appuie prend la main.</small>

          {currentUserPosition != null && (
            <form action={pressFortuneBuzzerV87}>
              <input type="hidden" name="game_id" value={game.id} />
              <button
                type="submit"
                className={styles.buzzerButton}
                disabled={!canBuzz}
              >
                BUZZER
              </button>
            </form>
          )}

          {isManager && (
            <form action={resetFortuneBuzzerV87}>
              <input type="hidden" name="game_id" value={game.id} />
              <button type="submit">Réarmer le buzzer</button>
            </form>
          )}
        </article>
      </div>

      {extra.pending_special_action && (
        <article className={styles.specialActionPanel}>
          <span>CASE SPÉCIALE · {extra.pending_special_label}</span>
          <h3>
            {extra.pending_special_action === "divide_bank"
              ? "Choisir la cagnotte de manche à diviser par deux"
              : "Choisir le joueur avec qui échanger la cagnotte de manche"}
          </h3>
          <p>
            Seule la cagnotte de la manche est concernée. La cagnotte
            sécurisée reste toujours intacte.
          </p>

          {isPendingActor ? (
            <form action={resolveFortuneSpecialV87} className={styles.specialForm}>
              <input type="hidden" name="game_id" value={game.id} />
              <select name="target_position" required defaultValue="">
                <option value="" disabled>
                  Choisir une personne
                </option>
                {targetPlayers.map((player) => (
                  <option key={player.position} value={player.position}>
                    {player.player_name} — manche : {player.round_bank.toLocaleString("fr-FR")} €
                  </option>
                ))}
              </select>
              <button type="submit" disabled={targetPlayers.length === 0}>
                {extra.pending_special_action === "divide_bank"
                  ? "Diviser cette cagnotte"
                  : "Échanger les cagnottes"}
              </button>
            </form>
          ) : (
            <strong>
              {actor?.player_name || extra.pending_actor_name || "Le joueur actif"}
              {" "}doit choisir la cible.
            </strong>
          )}
        </article>
      )}
    </section>
  );
}
