"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { submitFortuneLetter, submitFortuneSolution } from "@/app/actions/fortune";
import type { FortuneGame, FortunePlayer, FortuneSegment, FortuneSettings } from "@/lib/fortune/data";
import styles from "./fortune.module.css";

export function FortunePlayerControls({
  game,
  currentPlayer,
  settings,
  visibleSegments,
  onSpinResult,
}: {
  game: FortuneGame;
  currentPlayer: FortunePlayer | null;
  settings: FortuneSettings;
  visibleSegments: FortuneSegment[];
  onSpinResult: (segmentPosition: number, label: string) => void;
}) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActive = currentPlayer?.position === game.active_player_position;
  const canSpin =
    isActive &&
    ((game.status === "active" && ["must_spin", "can_act"].includes(game.turn_phase)) ||
      (game.status === "finale" && game.turn_phase === "final_spin"));
  const canConsonant = isActive && game.status === "active" && game.turn_phase === "choose_consonant";
  const canVowel =
    isActive &&
    game.status === "active" &&
    ["must_spin", "can_act"].includes(game.turn_phase) &&
    (currentPlayer?.round_bank ?? 0) >= settings.vowel_cost;
  const canPropose =
    isActive &&
    ((game.status === "active" && game.turn_phase !== "waiting") ||
      (game.status === "finale" && game.turn_phase === "final_answer"));

  async function spin() {
    if (!canSpin || spinning) return;
    setSpinning(true);
    setError(null);
    try {
      const response = await fetch("/api/fortune/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id }),
      });
      const result = (await response.json()) as {
        error?: string;
        segment_position?: number;
        label?: string;
      };
      if (!response.ok) throw new Error(result.error || "spin_failed");
      const position = Number(result.segment_position);
      if (!Number.isFinite(position)) throw new Error("invalid_result");
      onSpinResult(position, String(result.label ?? "Résultat"));
      window.setTimeout(() => {
        setSpinning(false);
        router.refresh();
      }, 3900);
    } catch (caught) {
      setSpinning(false);
      setError(caught instanceof Error ? caught.message : "La roue n’a pas pu être lancée.");
    }
  }

  if (!currentPlayer) {
    return <section className={styles.spectatorPanel}>Tu regardes la partie en tant que spectateur.</section>;
  }

  return (
    <section className={styles.playerControls}>
      <div className={styles.playerControlHeading}>
        <div>
          <span>ESPACE JOUEUR</span>
          <h2>{currentPlayer.player_name}</h2>
        </div>
        <strong>{isActive ? "C’est à toi de jouer" : "Attends ton tour"}</strong>
      </div>

      {error && <div className={styles.controlError}>{error}</div>}

      <button
        className={styles.spinButton}
        type="button"
        onClick={spin}
        disabled={!canSpin || spinning || visibleSegments.length === 0}
      >
        {spinning
          ? "La roue tourne…"
          : game.status === "finale"
            ? "Tourner la roue finale"
            : "Tourner la roue"}
      </button>

      <div className={styles.controlGrid}>
        <form action={submitFortuneLetter} className={styles.controlCard}>
          <input type="hidden" name="game_id" value={game.id} />
          <input type="hidden" name="kind" value="consonant" />
          <label>
            <span>Choisir une consonne</span>
            <input name="letter" type="text" maxLength={1} required disabled={!canConsonant} placeholder="R" />
          </label>
          <button type="submit" disabled={!canConsonant}>Valider ma lettre</button>
        </form>

        <form action={submitFortuneLetter} className={styles.controlCard}>
          <input type="hidden" name="game_id" value={game.id} />
          <input type="hidden" name="kind" value="vowel" />
          <label>
            <span>Acheter une voyelle ({settings.vowel_cost.toLocaleString("fr-FR")} €)</span>
            <input name="letter" type="text" maxLength={1} required disabled={!canVowel} placeholder="A" />
          </label>
          <button type="submit" disabled={!canVowel}>Acheter la voyelle</button>
        </form>
      </div>

      <form action={submitFortuneSolution} className={styles.solutionForm}>
        <input type="hidden" name="game_id" value={game.id} />
        <label>
          <span>Proposer la solution complète</span>
          <input
            name="solution"
            type="text"
            maxLength={300}
            required
            disabled={!canPropose}
            placeholder="Écris ici ta proposition"
          />
        </label>
        <button type="submit" disabled={!canPropose}>Proposer la solution</button>
      </form>

      {game.jackpot_armed && isActive && (
        <div className={styles.jackpotArmed}>
          JACKPOT ARMÉ : trouve l’énigme maintenant pour remporter la cagnotte persistante.
        </div>
      )}
    </section>
  );
}
