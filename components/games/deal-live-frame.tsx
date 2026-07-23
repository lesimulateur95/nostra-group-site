"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { DealPublicState, DealViewerMode } from "@/lib/deal/types";

import styles from "./deal-live.module.css";

export function DealLiveFrame({
  children,
  initialMode,
  initialPlayerName,
}: {
  children: ReactNode;
  initialMode: DealViewerMode;
  initialPlayerName: string | null;
}) {
  const [mode, setMode] = useState<DealViewerMode>(initialMode);
  const [playerName, setPlayerName] = useState(initialPlayerName);

  useEffect(() => {
    const refresh = async () => {
      try {
        const response = await fetch("/api/games/deal/state", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const state = (await response.json()) as DealPublicState;
        setMode(state.viewer_mode ?? "waiting");
        setPlayerName(state.selected_player_name ?? state.session?.player_name ?? null);
      } catch {
        // La page de jeu conserve son état actuel pendant une coupure passagère.
      }
    };

    const timer = window.setInterval(() => {
      void refresh();
    }, 2_000);

    return () => window.clearInterval(timer);
  }, []);

  const spectator = mode === "spectator";

  return (
    <div className={styles.liveFrame}>
      {spectator && (
        <div className={styles.spectatorBanner} role="status">
          <span>👁️ MODE SPECTATEUR</span>
          <strong>
            Partie de {playerName ?? "un citoyen Nostra Group"}
          </strong>
          <small>
            Tu suis la partie en direct, mais seul le citoyen sélectionné peut
            choisir une boîte et répondre au banquier.
          </small>
        </div>
      )}

      <fieldset
        className={`${styles.liveContent} ${spectator ? styles.spectatorLocked : ""}`}
        disabled={spectator}
      >
        {children}
      </fieldset>
    </div>
  );
}
