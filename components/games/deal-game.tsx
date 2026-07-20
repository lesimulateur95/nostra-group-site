
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  answerDealBankerOffer,
  chooseDealBox,
  openDealBox,
  startDealGame,
  type DealActionResult,
} from "@/app/actions/deal-game";
import type { DealPublicState } from "@/lib/deal/types";
import styles from "./deal-game.module.css";

const statusMessages: Record<string, string> = {
  choosing: "Choisis la boîte que tu conserveras jusqu’à la fin.",
  playing: "Ouvre une boîte à la fois et surveille les gains éliminés.",
  banker_call: "Le banquier vous appelle…",
  accepted: "Vous avez accepté la proposition du banquier.",
  final: "Toutes les autres boîtes sont ouvertes.",
  stopped: "La direction a arrêté cette partie.",
};

function errorMessage(error?: string): string {
  switch (error) {
    case "auth":
      return "Reconnecte-toi avant de jouer.";
    case "closed":
      return "Aucune partie n’est actuellement ouverte.";
    case "exists":
      return "Une partie existe déjà pour cette édition.";
    case "box":
      return "Cette boîte ne peut pas être sélectionnée.";
    case "banker":
      return "Réponds d’abord au banquier.";
    case "status":
      return "Cette action n’est pas disponible à cette étape.";
    default:
      return "L’action n’a pas pu être enregistrée. Réessaie dans un instant.";
  }
}

function makeEliminatedFlags(
  prizes: string[],
  openedPrizes: string[],
): boolean[] {
  const counts = new Map<string, number>();

  for (const prize of openedPrizes) {
    counts.set(prize, (counts.get(prize) ?? 0) + 1);
  }

  return prizes.map((prize) => {
    const count = counts.get(prize) ?? 0;
    if (count <= 0) return false;
    counts.set(prize, count - 1);
    return true;
  });
}

function playTone(
  frequency: number,
  duration: number,
  volume = 0.05,
) {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.value = volume;

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();

  window.setTimeout(() => {
    oscillator.stop();
    void context.close();
  }, duration);
}

function playBankerRing() {
  playTone(720, 180, 0.055);
  window.setTimeout(() => playTone(920, 220, 0.055), 260);
  window.setTimeout(() => playTone(720, 180, 0.055), 590);
}

export function DealGame({
  initialState,
}: {
  initialState: DealPublicState;
}) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isPending, startTransition] = useTransition();
  const previousCall = useRef(
    initialState.session?.status === "banker_call",
  );

  const refreshState = async () => {
    try {
      const response = await fetch("/api/games/deal/state", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return;
      const nextState = (await response.json()) as DealPublicState;
      setState(nextState);
    } catch {
      // Une coupure momentanée ne doit pas fermer l’interface.
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshState();
    }, 2_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const callIsOpen = state.session?.status === "banker_call";

    if (callIsOpen && !previousCall.current && soundEnabled) {
      playBankerRing();
    }

    previousCall.current = callIsOpen;
  }, [soundEnabled, state.session?.status]);

  const runAction = (
    action: () => Promise<DealActionResult>,
    sound?: "open" | "choice" | "accept",
  ) => {
    setError(null);

    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }

      if (soundEnabled && sound === "open") {
        playTone(440, 150);
      } else if (soundEnabled && sound === "choice") {
        playTone(660, 180);
      } else if (soundEnabled && sound === "accept") {
        playTone(880, 320, 0.06);
      }

      await refreshState();
    });
  };

  const prizes = state.edition?.prize_labels ?? [];
  const openedPrizes =
    state.session?.opened_boxes.map((box) => box.prize_label) ?? [];
  const eliminatedFlags = useMemo(
    () => makeEliminatedFlags(prizes, openedPrizes),
    [openedPrizes, prizes],
  );

  const boxes = Array.from(
    { length: state.edition?.box_count ?? 24 },
    (_, index) => index + 1,
  );

  const openedByNumber = new Map(
    state.session?.opened_boxes.map((box) => [
      box.box_number,
      box.prize_label,
    ]) ?? [],
  );

  if (!state.configured) {
    return (
      <section className={styles.setup}>
        <h2>Activation nécessaire</h2>
        <p>
          Le Gérant doit activer le module V36 depuis le Dashboard.
        </p>
      </section>
    );
  }

  if (!state.edition) {
    return (
      <section className={styles.setup}>
        <h2>Aucune partie ouverte</h2>
        <p>
          Le Gérant n’a pas encore créé de nouvelle édition.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.game}>
      <header className={styles.gameHeader}>
        <div>
          <span className={styles.eyebrow}>ÉDITION EN COURS</span>
          <h2>{state.edition.title}</h2>
          <p>
            {state.session
              ? statusMessages[state.session.status]
              : "Commence ta partie pour découvrir les 24 boîtes."}
          </p>
        </div>

        <button
          className={styles.soundButton}
          type="button"
          onClick={() => setSoundEnabled((value) => !value)}
        >
          {soundEnabled ? "🔊 Sons activés" : "🔇 Activer les sons"}
        </button>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {!state.session && (
        <section className={styles.startPanel}>
          <div className={styles.giftIcon}>🎁</div>
          <h3>À Prendre ou à Laisser</h3>
          <p>
            Les gains ont été mélangés secrètement dans 24 boîtes.
            Choisis d’abord ta boîte, puis élimine les autres une par
            une.
          </p>
          <button
            className={styles.primaryButton}
            disabled={isPending}
            type="button"
            onClick={() => runAction(startDealGame, "choice")}
          >
            {isPending ? "Préparation…" : "Commencer ma partie"}
          </button>
        </section>
      )}

      {state.session && (
        <>
          <div className={styles.stage}>
            <PrizeBoard
              prizes={prizes.slice(0, 12)}
              eliminated={eliminatedFlags.slice(0, 12)}
              side="left"
            />

            <section className={styles.boxArea}>
              <div className={styles.progress}>
                <span>
                  {state.session.opened_count} boîte
                  {state.session.opened_count > 1 ? "s" : ""} ouverte
                  {state.session.opened_count > 1 ? "s" : ""}
                </span>
                {state.session.selected_box && (
                  <strong>
                    Ma boîte : {state.session.selected_box}
                  </strong>
                )}
              </div>

              <div className={styles.boxGrid}>
                {boxes.map((boxNumber) => {
                  const openedPrize = openedByNumber.get(boxNumber);
                  const selected =
                    state.session?.selected_box === boxNumber;
                  const canChoose =
                    state.session?.status === "choosing";
                  const canOpen =
                    state.session?.status === "playing" &&
                    !selected &&
                    !openedPrize;

                  return (
                    <button
                      className={`${styles.box} ${
                        selected ? styles.selectedBox : ""
                      } ${openedPrize ? styles.openedBox : ""}`}
                      disabled={
                        isPending || (!canChoose && !canOpen)
                      }
                      key={boxNumber}
                      type="button"
                      onClick={() => {
                        if (canChoose) {
                          runAction(
                            () => chooseDealBox(boxNumber),
                            "choice",
                          );
                        } else if (canOpen) {
                          runAction(
                            () => openDealBox(boxNumber),
                            "open",
                          );
                        }
                      }}
                    >
                      <span className={styles.boxLid} />
                      <strong>{boxNumber}</strong>
                      <small>
                        {openedPrize
                          ? openedPrize
                          : selected
                            ? "MA BOÎTE"
                            : canChoose
                              ? "CHOISIR"
                              : "FERMÉE"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>

            <PrizeBoard
              prizes={prizes.slice(12)}
              eliminated={eliminatedFlags.slice(12)}
              side="right"
            />
          </div>

          {(state.session.status === "accepted" ||
            state.session.status === "final") && (
            <section className={styles.result}>
              <span>🏆 RÉSULTAT OFFICIEL</span>
              <h3>{state.session.final_reward}</h3>
              {state.session.selected_box && (
                <p>
                  La boîte {state.session.selected_box} contenait :
                  <strong>
                    {" "}
                    {state.session.selected_box_prize}
                  </strong>
                </p>
              )}
            </section>
          )}

          {state.session.status === "stopped" && (
            <section className={styles.stopped}>
              <h3>Partie arrêtée</h3>
              <p>
                La direction a interrompu cette partie. Contacte
                l’équipe Nostra Group si nécessaire.
              </p>
            </section>
          )}
        </>
      )}

      {state.session?.status === "banker_call" && (
        <div className={styles.bankerOverlay} role="dialog">
          <section className={styles.bankerCall}>
            <div className={styles.phone}>☎</div>
            <span>APPEL ENTRANT</span>
            <h2>Ici le banquier…</h2>
            <p>Je vous propose :</p>
            <strong>{state.session.banker_offer}</strong>

            <div className={styles.bankerActions}>
              <button
                className={styles.acceptButton}
                disabled={isPending}
                type="button"
                onClick={() =>
                  runAction(
                    () => answerDealBankerOffer("accept"),
                    "accept",
                  )
                }
              >
                🟢 À prendre
              </button>
              <button
                className={styles.declineButton}
                disabled={isPending}
                type="button"
                onClick={() =>
                  runAction(() =>
                    answerDealBankerOffer("decline"),
                  )
                }
              >
                🔴 À laisser
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PrizeBoard({
  prizes,
  eliminated,
  side,
}: {
  prizes: string[];
  eliminated: boolean[];
  side: "left" | "right";
}) {
  return (
    <aside
      className={`${styles.prizeBoard} ${
        side === "left" ? styles.leftBoard : styles.rightBoard
      }`}
    >
      <span className={styles.boardTitle}>TABLEAU DES GAINS</span>
      {prizes.map((prize, index) => (
        <div
          className={`${styles.prize} ${
            eliminated[index] ? styles.eliminatedPrize : ""
          }`}
          key={`${side}-${index}-${prize}`}
        >
          <span>{prize}</span>
        </div>
      ))}
    </aside>
  );
}
